import { expect, test } from "@playwright/test";

test("real Gold metrics, UTC filters, and responsive overview", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "서비스 전체 현황" }),
  ).toBeVisible();
  await expect(page.locator(".stat-value").first()).toContainText("1,000");
  await expect(page.locator(".stat-value").nth(1)).toContainText("34");
  await expect(
    page.getByRole("link", { name: "payment 로그 보기" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../artifacts/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("환경", { exact: true }).selectOption("staging");
  await expect(page.getByText("아직 집계된 데이터가 없습니다")).toBeVisible();
  await page.getByLabel("환경", { exact: true }).selectOption("production");
  await expect(page.locator(".stat-value").first()).toContainText("1,000");
  await page.getByLabel("조회 날짜").fill("2026-09-30");
  await expect(page.getByText("아직 집계된 데이터가 없습니다")).toBeVisible();
  await page.getByLabel("조회 날짜").fill("2026-10-01");
  await expect(page.locator(".stat-value").first()).toContainText("1,000");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("link", { name: "분석 도우미", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "../artifacts/dashboard-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("MongoDB search, literal regex characters, pagination, and event dialog", async ({
  page,
}) => {
  await page.goto("/logs");
  await expect(page.getByText("1,000 events")).toBeVisible();
  await page.getByRole("button", { name: "다음 페이지" }).click();
  await expect(page.locator(".pagination")).toContainText("26–50");
  await page.getByLabel("로그 수준 필터").selectOption("ERROR");
  await expect(page.getByText("34 events")).toBeVisible();
  await page.getByLabel("서비스 필터").selectOption("payment");
  await expect(page.locator(".logs-table tbody tr").first()).toContainText(
    "payment",
  );
  await page.locator(".detail-button").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("trace-");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByLabel("로그 검색").fill(".*");
  await expect(
    page.getByText("조회 결과가 없습니다", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "검색어 지우기" }).click();
  await expect(page.locator(".detail-button").first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "../artifacts/logs-mobile.png",
    fullPage: true,
  });
});

test("Neo4j node selection and runbook retrieval", async ({ page }) => {
  await page.goto("/topology");
  await expect(
    page.getByRole("button", { name: "checkout 관계 조회" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "payment 관계 조회" }).click();
  await expect(
    page.getByText("payment 분석 근거", { exact: true }),
  ).toBeVisible();
  await page
    .getByText("Payment timeout and upstream unavailable", { exact: true })
    .click();
  await expect(page.getByText(/외부 결제사의 응답 시간/)).toBeVisible();
  await page.screenshot({
    path: "../artifacts/topology-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("cost-free evidence conversation uses real services", async ({ page }) => {
  await page.goto("/assistant");
  await expect(
    page.getByRole("button", {
      name: "checkout의 지연이 증가한 이유를 조사해줘",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "checkout의 지연이 증가한 이유를 조사해줘" })
    .click();
  await page.getByRole("button", { name: "분석 요청 보내기" }).click();
  await expect(
    page.getByText("checkout 분석 근거", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("inventory, payment", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "../artifacts/assistant-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "대화 지우기" }).click();
  await expect(page.getByText("어떤 서비스를 살펴볼까요?")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "../artifacts/assistant-mobile.png",
    fullPage: true,
  });
});

test("backend failure has a recoverable error state", async ({ page }) => {
  await page.route("**/api/metrics?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Agent unavailable" }),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "데이터를 불러오지 못했습니다",
  );
  await page.unroute("**/api/metrics?**");
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.locator(".stat-value").first()).toContainText("1,000");
});
