"""Idempotently create the local catalog and grant its role to the root principal role."""

import json
import urllib.error
import urllib.parse
import urllib.request

BASE = "http://polaris:8181/api"
payload = urllib.parse.urlencode(
    {
        "grant_type": "client_credentials",
        "client_id": "root",
        "client_secret": "ops-lab-secret",
        "scope": "PRINCIPAL_ROLE:ALL",
    }
).encode()
with urllib.request.urlopen(
    BASE + "/catalog/v1/oauth/tokens", data=payload, timeout=30
) as response:
    token = json.load(response)["access_token"]


def request(method, path, data=None, exists_ok=False):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "Polaris-Realm": "POLARIS",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            body = response.read()
            return json.loads(body) if body else None
    except urllib.error.HTTPError as error:
        if exists_ok and error.code == 409:
            return None
        raise RuntimeError(f"{method} {path}: {error.code} {error.read().decode()}") from error


request(
    "POST",
    "/management/v1/catalogs",
    {
        "catalog": {
            "name": "ops",
            "type": "INTERNAL",
            "readOnly": False,
            "properties": {"default-base-location": "s3://warehouse/ops"},
            "storageConfigInfo": {
                "storageType": "S3",
                "allowedLocations": ["s3://warehouse/ops"],
                "endpoint": "http://objectstore:9000",
                "endpointInternal": "http://objectstore:9000",
                "pathStyleAccess": True,
                "region": "us-east-1",
            },
        }
    },
    exists_ok=True,
)
request(
    "POST",
    "/management/v1/catalogs/ops/catalog-roles",
    {"catalogRole": {"name": "pipeline", "properties": {}}},
    exists_ok=True,
)
request(
    "PUT",
    "/management/v1/catalogs/ops/catalog-roles/pipeline/grants",
    {"type": "catalog", "privilege": "CATALOG_MANAGE_CONTENT"},
)
request(
    "PUT",
    "/management/v1/principal-roles/service_admin/catalog-roles/ops",
    {"catalogRole": {"name": "pipeline"}},
)
print("Polaris catalog ops ready")
