import httpx


class HTTPCoreGateway:
    def __init__(self, base_url: str):
        self.client = httpx.Client(base_url=base_url, timeout=15)

    def close(self):
        self.client.close()

    def register(self, service: dict) -> None:
        result = self.client.post("/v1/services", json=service)
        if result.status_code == 409:
            existing = self.client.get(f"/v1/services/{service['id']}")
            existing.raise_for_status()
            if existing.json() != service:
                raise ValueError(f"service definition differs: {service['id']}")
        else:
            result.raise_for_status()

    def ingest(self, event: dict) -> bool:
        result = self.client.post("/v1/events", json=event)
        result.raise_for_status()
        return result.json()["created"]
