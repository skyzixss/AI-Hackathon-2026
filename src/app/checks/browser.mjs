// Isolated HTTP fixtures, never imported by the product. Not a live Supabase test.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
const { chromium } = await import(
  modulePath ? pathToFileURL(resolve(modulePath)).href : "playwright"
);
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const output = resolve(
  process.env.UI_SCREENSHOT_DIR || "work/ui-check/screenshots",
);
await mkdir(output, { recursive: true });
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Moscow",
}).format(new Date());
const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
];
let checks = 0;
async function check(condition) {
  assert.ok(await condition);
  checks++;
}
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
function token(id) {
  return [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: id,
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: "authenticated",
        role: "authenticated",
      }),
    ).toString("base64url"),
    "fictional-test-signature",
  ].join(".");
}
function user(id) {
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: `student-${id === ids[0] ? "a" : "b"}@example.test`,
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-11-01T00:00:00Z",
  };
}
function session(id) {
  return {
    access_token: token(id),
    token_type: "bearer",
    refresh_token: `fictional-refresh-${id}`,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: user(id),
  };
}

try {
  for (const width of [1440, 360]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 360 ? 800 : 1000 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let failGrades = false,
      failLogout = false,
      slowSchedule = false,
      emptySchedule = false;
    await context.route("https://portal-test.invalid/**", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      const bearer = request.headers().authorization?.split(" ")[1];
      const id =
        bearer && bearer.split(".").length === 3
          ? JSON.parse(
              Buffer.from(bearer.split(".")[1], "base64url").toString(),
            ).sub
          : ids[0];
      const isA = id === ids[0];
      let status = 200,
        body;
      if (request.method() === "OPTIONS")
        return route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "*",
            "access-control-allow-methods": "*",
          },
        });
      if (url.pathname.endsWith("/token")) {
        const fields = request.postDataJSON();
        if (fields.password === "wrong-password") {
          status = 400;
          body = {
            error_code: "invalid_credentials",
            msg: "Invalid credentials",
          };
        } else
          body = session(
            fields.email === "student-b@example.test" ? ids[1] : ids[0],
          );
      } else if (url.pathname.endsWith("/logout")) {
        status = failLogout ? 503 : 204;
        body = failLogout ? { msg: "Unavailable" } : null;
      } else if (url.pathname.endsWith("/user")) body = user(id);
      else if (url.pathname.endsWith("/profiles"))
        body = {
          student_id: id,
          full_name: isA ? "Демо Студент Альфа" : "Демо Студент Бета",
          faculty: "Вымышленный факультет",
          program: isA ? "Информатика" : "Экономика",
          course: isA ? 2 : 3,
          group_name: isA ? "ДЕМО-А" : "ДЕМО-Б",
        };
      else if (url.pathname.endsWith("/schedule_entries")) {
        if (slowSchedule) await wait(1400);
        const lesson = {
          id: `lesson-${id}`,
          student_id: id,
          subject: isA ? "Тестовые алгоритмы" : "Тестовая экономика",
          starts_at: `${today}T10:00:00+03:00`,
          ends_at: `${today}T11:30:00+03:00`,
          room: "Демо-101",
          teacher: "Вымышленный Преподаватель",
          change_note: isA ? "Аудитория изменена: Демо-101" : null,
        };
        const [from, to] = url.searchParams
          .getAll("starts_at")
          .map((value) => Date.parse(value.slice(value.indexOf(".") + 1)));
        body =
          emptySchedule ||
          Date.parse(lesson.starts_at) < from ||
          Date.parse(lesson.starts_at) >= to
            ? []
            : [lesson];
      } else if (url.pathname.endsWith("/grades")) {
        if (failGrades === "auth") {
          status = 401;
          body = { code: "PGRST301", message: "JWT expired" };
        } else if (failGrades) {
          status = 503;
          body = { message: "Temporary failure" };
        } else
          body = [
            {
              id: `grade-${id}`,
              student_id: id,
              subject: isA ? "Тестовые алгоритмы" : "Тестовая экономика",
              assessment: "exam",
              result: isA ? "5" : "4",
              semester: 3,
              exam_at: `${today}T09:00:00+03:00`,
            },
          ];
      } else throw new Error(`Unexpected test request: ${url.pathname}`);
      await route.fulfill({
        status,
        headers: {
          "access-control-allow-origin": "*",
          "content-type": "application/json",
        },
        body: body === null ? "" : JSON.stringify(body),
      });
    });
    async function login(
      email = "student-a@example.test",
      password = "fictional-ui-password",
    ) {
      await page.getByLabel("Электронная почта", { exact: true }).fill(email);
      await page.getByLabel("Пароль", { exact: true }).fill(password);
      await page
        .getByRole("button", { name: "Войти в кабинет", exact: true })
        .click();
    }
    async function navigate(hash) {
      await page.locator(`nav a[href="#${hash}"]`).click();
    }
    await page.goto(process.env.PORTAL_URL || "http://127.0.0.1:5173");
    await login("student-a@example.test", "wrong-password");
    await page
      .getByRole("alert")
      .filter({ hasText: "Не удалось войти" })
      .waitFor();
    checks++;
    await login();
    await page.getByRole("heading", { name: "Привет, Демо." }).waitFor();
    await page
      .getByText("Тестовые алгоритмы", { exact: true })
      .first()
      .waitFor();
    checks++;
    await check(
      page
        .getByText("Аудитория изменена: Демо-101", { exact: true })
        .isVisible(),
    );
    await check(
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await page.screenshot({
      path: `${output}/${width === 360 ? "mobile" : "desktop"}.png`,
      fullPage: true,
    });
    await navigate("profile");
    await page.getByRole("heading", { name: "Демо Студент Альфа" }).waitFor();
    checks++;
    await check(page.getByText("ДЕМО-А", { exact: true }).isVisible());
    await page.getByRole("link", { name: "К содержимому" }).focus();
    await page.getByRole("link", { name: "К содержимому" }).click();
    await check(
      page.evaluate(
        () =>
          location.hash === "#profile" &&
          document.activeElement?.id === "main-content",
      ),
    );
    await navigate("schedule");
    await page.getByRole("button", { name: "Неделя", exact: true }).click();
    await page.getByText("Тестовые алгоритмы", { exact: true }).waitFor();
    await check(
      page
        .locator(".schedule-day")
        .count()
        .then((count) => count === 7),
    );
    await page.getByLabel("Выбрать дату").fill("2027-01-03");
    await page.getByText("На этот день занятий нет").first().waitFor();
    checks++;
    await check(
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    failGrades = true;
    await navigate("grades");
    await page
      .getByRole("alert")
      .filter({ hasText: "Не удалось загрузить" })
      .waitFor();
    checks++;
    failGrades = false;
    await page.getByRole("button", { name: "Попробовать снова" }).click();
    await page.getByRole("heading", { name: "Тестовые алгоритмы" }).waitFor();
    checks++;
    await page.getByLabel("Период", { exact: true }).selectOption("3");
    await check(page.getByText("за 3 семестр", { exact: true }).isVisible());
    failGrades = "auth";
    await navigate("home");
    await navigate("grades");
    await page
      .getByRole("alert")
      .filter({ hasText: "Сессия истекла" })
      .waitFor();
    checks++;
    failGrades = false;
    await navigate("home");
    slowSchedule = true;
    await navigate("schedule");
    await page.getByRole("status").waitFor();
    await page.getByRole("button", { name: "Выйти из кабинета" }).click();
    await page.getByRole("button", { name: "Войти в кабинет" }).waitFor();
    checks++;
    await login("student-b@example.test");
    await page.getByRole("heading", { name: "Привет, Демо." }).waitFor();
    await page
      .getByText("Тестовая экономика", { exact: true })
      .first()
      .waitFor();
    await wait(1500);
    await check(
      page
        .getByText("Тестовые алгоритмы", { exact: true })
        .count()
        .then((count) => count === 0),
    );
    await navigate("profile");
    await page.getByRole("heading", { name: "Демо Студент Бета" }).waitFor();
    checks++;
    await page.reload();
    await page.getByRole("heading", { name: "Демо Студент Бета" }).waitFor();
    checks++;
    await check(
      page
        .getByText("ДЕМО-А", { exact: true })
        .count()
        .then((count) => count === 0),
    );
    const secondTab = await context.newPage();
    await secondTab.goto(process.env.PORTAL_URL || "http://127.0.0.1:5173");
    await secondTab.getByRole("heading", { name: "Привет, Демо." }).waitFor();
    await secondTab.getByRole("button", { name: "Выйти из кабинета" }).click();
    await page.getByRole("button", { name: "Войти в кабинет" }).waitFor();
    await check(
      page.getByText("Сессия завершена.", { exact: false }).isVisible(),
    );
    await secondTab.close();
    await login("student-b@example.test");
    await navigate("home");
    await page.getByRole("heading", { name: "Привет, Демо." }).waitFor();
    emptySchedule = true;
    await navigate("schedule");
    await page.getByText("На этот день занятий нет").waitFor();
    checks++;
    await page.keyboard.press("Tab");
    await check(
      page.evaluate(
        () =>
          !!document.activeElement && document.activeElement !== document.body,
      ),
    );
    failLogout = true;
    await page.getByRole("button", { name: "Выйти из кабинета" }).click();
    await page
      .getByRole("heading", { name: "Не удалось завершить сессию" })
      .waitFor();
    await check(
      page
        .getByText("Демо Студент Бета", { exact: true })
        .count()
        .then((count) => count === 0),
    );
    failLogout = false;
    await page.getByRole("button", { name: "Повторить выход" }).click();
    await page.getByRole("button", { name: "Войти в кабинет" }).waitFor();
    checks++;
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    `Isolated UI browser: ${checks} checks passed at 1440 px and 360 px. Not a live Supabase test.`,
  );
} finally {
  await browser.close();
}
