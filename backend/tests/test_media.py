"""4-bosqich: galereya, planirovkalar, lokatsiya va ularning xavfsizligi."""

from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.realty.models import Layout, ProjectPhoto, Unit

from .conftest import auth


@pytest.fixture(autouse=True)
def _media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


def make_image(fmt="JPEG", size=(800, 600), gps=False, name=None, mode="RGB") -> SimpleUploadedFile:
    img = Image.new(mode, size, (40, 120, 200) if mode == "RGB" else 0)
    buf = BytesIO()
    kwargs = {}
    if gps:
        exif = Image.Exif()
        exif[0x010F] = "SecretPhone"          # Make
        exif[0x8825] = {1: "N", 2: (41.0, 18.0, 0.0)}  # GPSInfo
        kwargs["exif"] = exif
    img.save(buf, format=fmt, **kwargs)
    ext = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp", "GIF": "gif"}[fmt]
    return SimpleUploadedFile(name or f"photo.{ext}", buf.getvalue(), content_type=f"image/{ext}")


def upload(api, project, **extra):
    data = {"project": project.id, "image": extra.pop("image", None) or make_image(), **extra}
    return api.post("/api/v1/photos/", data, format="multipart")


# ---------------- Galereya ----------------

def test_upload_photo_reencodes_to_webp_and_strips_exif(api, director_a, project_a):
    res = upload(auth(api, director_a), project_a, image=make_image(gps=True), caption="Fasad")
    assert res.status_code == 201, res.data
    assert res.data["image"].startswith("/media/projects/photos/") and res.data["image"].endswith(".webp")
    assert res.data["thumb"].endswith(".webp")

    photo = ProjectPhoto.objects.get(pk=res.data["id"])
    assert photo.company_id == project_a.company_id
    with Image.open(photo.image.path) as img:
        assert img.format == "WEBP"
        assert not img.getexif()  # GPS va qurilma ma'lumoti qolmagan
    with Image.open(photo.thumb.path) as th:
        assert max(th.size) <= 640


def test_large_photo_is_downscaled(api, director_a, project_a):
    res = upload(auth(api, director_a), project_a, image=make_image(size=(4000, 1000)))
    assert res.status_code == 201
    assert (res.data["width"], res.data["height"]) == (2560, 640)


def test_project_cover_is_first_photo(api, director_a, project_a):
    auth(api, director_a)
    first = upload(api, project_a).data
    upload(api, project_a)
    res = api.get(f"/api/v1/projects/{project_a.id}/")
    assert res.data["cover"] == first["thumb"]
    assert res.data["photos_count"] == 2


@pytest.mark.parametrize(
    "file",
    [
        SimpleUploadedFile("evil.jpg", b"<script>alert(1)</script>", content_type="image/jpeg"),
        SimpleUploadedFile("x.svg", b'<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>', content_type="image/svg+xml"),
    ],
)
def test_non_images_rejected(api, director_a, project_a, file):
    res = upload(auth(api, director_a), project_a, image=file)
    assert res.status_code == 400
    assert not ProjectPhoto.objects.exists()


def test_gif_rejected(api, director_a, project_a):
    res = upload(auth(api, director_a), project_a, image=make_image("GIF", mode="L"))
    assert res.status_code == 400


def test_decompression_bomb_rejected(api, director_a, project_a):
    # 9000×5000 = 45 MP, lekin siqilgan PNG bir necha KB — klassik "bomba"
    res = upload(auth(api, director_a), project_a, image=make_image("PNG", size=(9000, 5000), mode="L"))
    assert res.status_code == 400
    assert not ProjectPhoto.objects.exists()


def test_photo_size_limit(api, director_a, project_a, settings):
    settings.MAX_PHOTO_SIZE_MB = 0.001  # ~1 KB
    res = upload(auth(api, director_a), project_a, image=make_image(size=(400, 400)))
    assert res.status_code == 400


def test_manager_cannot_upload_but_can_view(api, manager_a, director_a, project_a):
    upload(auth(api, director_a), project_a)
    api.force_authenticate(manager_a)
    assert upload(api, project_a).status_code == 403
    res = api.get(f"/api/v1/photos/?project={project_a.id}")
    assert res.status_code == 200 and len(res.data) == 1


def test_cannot_upload_to_other_company_project(api, director_a, project_b):
    res = upload(auth(api, director_a), project_b)
    assert res.status_code == 400
    assert "project" in res.data


def test_cannot_touch_other_company_photo(api, director_a, director_b, project_b):
    res = upload(auth(api, director_b), project_b)
    pid = res.data["id"]
    api.force_authenticate(director_a)
    assert api.delete(f"/api/v1/photos/{pid}/").status_code == 404
    assert api.patch(f"/api/v1/photos/{pid}/", {"caption": "x"}).status_code == 404
    assert api.get(f"/api/v1/photos/?project={project_b.id}").data == []


def test_block_must_belong_to_project(api, director_a, company_a, block_a):
    from apps.realty.models import Project

    other = Project.objects.create(company=company_a, name="Boshqa")
    res = upload(auth(api, director_a), other, block=block_a.id)
    assert res.status_code == 400 and "block" in res.data


def test_photo_limit(api, director_a, project_a, monkeypatch):
    monkeypatch.setattr("apps.realty.serializers.MAX_PHOTOS_PER_PROJECT", 1)
    auth(api, director_a)
    assert upload(api, project_a).status_code == 201
    assert upload(api, project_a).status_code == 400


def test_list_requires_project(api, director_a):
    assert auth(api, director_a).get("/api/v1/photos/").status_code == 400


def test_update_cannot_replace_image_or_move_project(api, director_a, company_a, project_a):
    from apps.realty.models import Project

    auth(api, director_a)
    photo = upload(api, project_a).data
    other = Project.objects.create(company=company_a, name="Boshqa")
    res = api.patch(f"/api/v1/photos/{photo['id']}/", {"caption": "Yangi", "kind": "progress", "project": other.id})
    assert res.status_code == 200
    assert res.data["caption"] == "Yangi" and res.data["project"] == project_a.id
    assert res.data["image"] == photo["image"]


def test_reorder(api, director_a, project_a):
    auth(api, director_a)
    ids = [upload(api, project_a).data["id"] for _ in range(3)]
    res = api.post("/api/v1/photos/reorder/", {"project": project_a.id, "ids": ids[::-1]}, format="json")
    assert res.status_code == 200
    listed = [p["id"] for p in api.get(f"/api/v1/photos/?project={project_a.id}").data]
    assert listed == ids[::-1]


def test_reorder_rejects_foreign_or_partial_ids(api, director_a, director_b, project_a, project_b):
    foreign = upload(auth(api, director_b), project_b).data["id"]
    api.force_authenticate(director_a)
    mine = upload(api, project_a).data["id"]
    bad = api.post("/api/v1/photos/reorder/", {"project": project_a.id, "ids": [mine, foreign]}, format="json")
    assert bad.status_code == 400
    assert api.post("/api/v1/photos/reorder/", {"project": project_a.id, "ids": [mine, mine]}, format="json").status_code == 400


def test_delete_removes_files(api, director_a, project_a, tmp_path):
    auth(api, director_a)
    pid = upload(api, project_a).data["id"]
    photo = ProjectPhoto.objects.get(pk=pid)
    paths = [photo.image.path, photo.thumb.path]
    with pytest.MonkeyPatch.context():
        from django.test import TestCase

        with TestCase.captureOnCommitCallbacks(execute=True):
            assert api.delete(f"/api/v1/photos/{pid}/").status_code == 204
    import os

    assert not any(os.path.exists(p) for p in paths)


# ---------------- Planirovkalar ----------------

def test_generation_creates_layouts(block_a):
    layouts = Layout.objects.filter(project=block_a.project)
    assert sorted(layouts.values_list("name", flat=True)) == ["1 xonali · 40 m²", "2 xonali · 60.5 m²", "3 xonali · 85 m²"]
    assert not Unit.objects.filter(block=block_a, layout__isnull=True).exists()


def test_layout_list_and_image_upload(api, director_a, block_a):
    auth(api, director_a)
    res = api.get(f"/api/v1/layouts/?project={block_a.project_id}")
    assert res.status_code == 200 and len(res.data) == 3
    lay = res.data[0]
    assert lay["units_count"] == 10 and lay["image"] is None

    up = api.patch(f"/api/v1/layouts/{lay['id']}/", {"image": make_image("PNG", size=(1200, 900))}, format="multipart")
    assert up.status_code == 200, up.data
    assert up.data["image"].endswith(".webp") and up.data["thumb"].endswith(".webp")

    unit = api.get(f"/api/v1/units/?block={block_a.id}&rooms={lay['rooms']}").data["results"][0]
    assert unit["layout_info"]["image"] == up.data["image"]


def test_layout_image_can_be_cleared(api, director_a, block_a):
    auth(api, director_a)
    lay = Layout.objects.filter(project=block_a.project).first()
    api.patch(f"/api/v1/layouts/{lay.id}/", {"image": make_image()}, format="multipart")
    res = api.patch(f"/api/v1/layouts/{lay.id}/", {"image": None}, format="json")
    assert res.status_code == 200 and res.data["image"] is None and res.data["thumb"] is None


def test_unit_layout_must_be_same_project(api, director_a, company_a, block_a):
    from apps.realty.models import Project

    other = Project.objects.create(company=company_a, name="Boshqa")
    foreign_layout = Layout.objects.create(project=other, name="X", rooms=1, area=30)
    unit = Unit.objects.filter(block=block_a).first()
    res = auth(api, director_a).patch(f"/api/v1/units/{unit.id}/", {"layout": foreign_layout.id}, format="json")
    assert res.status_code == 400


def test_unit_cannot_use_other_company_layout(api, director_a, director_b, project_b, block_a):
    foreign = Layout.objects.create(project=project_b, name="Y", rooms=1, area=30)
    unit = Unit.objects.filter(block=block_a).first()
    res = auth(api, director_a).patch(f"/api/v1/units/{unit.id}/", {"layout": foreign.id}, format="json")
    assert res.status_code == 400


def test_layout_with_sold_units_cannot_be_deleted(api, director_a, block_a):
    unit = Unit.objects.filter(block=block_a).first()
    Unit.objects.filter(pk=unit.pk).update(status=Unit.Status.SOLD)
    res = auth(api, director_a).delete(f"/api/v1/layouts/{unit.layout_id}/")
    assert res.status_code == 400


def test_chessboard_includes_layouts(api, manager_a, block_a):
    res = auth(api, manager_a).get(f"/api/v1/projects/{block_a.project_id}/chessboard/")
    assert len(res.data["layouts"]) == 3
    first_unit = res.data["blocks"][0]["entrances"][0]["floors"][0]["units"][0]
    assert first_unit["layout_id"] in {lay["id"] for lay in res.data["layouts"]}


# ---------------- Lokatsiya ----------------

def test_location_and_nearby(api, director_a, project_a):
    payload = {
        "latitude": 41.311081, "longitude": 69.240562,
        "nearby": [{"kind": "metro", "name": "Minor", "distance_m": 450, "evil": "<script>"}],
    }
    res = auth(api, director_a).patch(f"/api/v1/projects/{project_a.id}/", payload, format="json")
    assert res.status_code == 200, res.data
    assert float(res.data["latitude"]) == pytest.approx(41.311081)
    assert res.data["nearby"] == [{"kind": "metro", "name": "Minor", "distance_m": 450}]  # ortiqcha kalit tashlab yuborildi


@pytest.mark.parametrize(
    "payload",
    [
        {"latitude": 41.3},                                     # faqat bittasi
        {"latitude": 91, "longitude": 69},                      # chegaradan tashqari
        {"nearby": [{"kind": "casino", "name": "x", "distance_m": 1}]},
        {"nearby": [{"kind": "park", "name": "x", "distance_m": -5}]},
        {"nearby": [{"kind": "park", "name": "x", "distance_m": 1}] * 21},
    ],
)
def test_location_validation(api, director_a, project_a, payload):
    res = auth(api, director_a).patch(f"/api/v1/projects/{project_a.id}/", payload, format="json")
    assert res.status_code == 400


def test_deleting_block_cleans_empty_layouts(api, director_a, block_a):
    lay = Layout.objects.filter(project=block_a.project).first()
    auth(api, director_a).patch(f"/api/v1/layouts/{lay.id}/", {"image": make_image()}, format="multipart")
    assert api.delete(f"/api/v1/blocks/{block_a.id}/").status_code == 204
    # chizmasi bor planirovka qoladi, qolgan bo'shlari o'chadi
    assert list(Layout.objects.filter(project=block_a.project).values_list("id", flat=True)) == [lay.id]
