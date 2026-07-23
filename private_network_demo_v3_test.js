#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Playwright is required. In Codex Desktop, run with the bundled NODE_PATH.");
  console.error(error.message);
  process.exit(1);
}

const input = process.argv.slice(2).find(arg => !arg.startsWith("--"))
  || path.join(__dirname, "private_network_demo_v3.html");
const shouldScreenshot = process.argv.includes("--screenshots");

function resolveBaseUrl(value) {
  if (/^(https?:|file:)/.test(value)) return value;
  const absolute = path.resolve(value);
  if (!fs.existsSync(absolute)) {
    throw new Error(`HTML file not found: ${absolute}`);
  }
  return pathToFileURL(absolute).toString();
}

function withQuery(baseUrl, query) {
  const url = new URL(baseUrl);
  url.search = query.startsWith("?") ? query.slice(1) : query;
  return url.toString();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const baseUrl = resolveBaseUrl(input);
  const browser = await chromium.launch({ headless: true });
  const cases = [
    { name: "page-01", query: "?page=1", expectMission: false },
    { name: "page-15-diagnostic", query: "?page=15", expectMission: false },
    { name: "page-16-hardware", query: "?page=16", expectMission: false },
    { name: "page-17-paper", query: "?page=17", expectMission: false, expectPaper: true },
    { name: "page-18-mission-default", query: "?page=18", expectMission: true, active: "四川政务" },
    { name: "page-19-overview", query: "?page=19", expectMission: false },
    { name: "mission-government", query: "?mission=government", expectMission: true, active: "四川政务" },
    { name: "mission-justice", query: "?mission=justice", expectMission: true, active: "四川政法" },
    { name: "mission-finance", query: "?mission=finance", expectMission: true, active: "四川金融" },
    { name: "mission-manufacturing", query: "?mission=manufacturing", expectMission: true, active: "制造集团" }
  ];

  try {
    for (const testCase of cases) {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => {
        if (message.type() === "error") errors.push(message.text());
      });

      await page.goto(withQuery(baseUrl, testCase.query), { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      const state = await page.evaluate(() => ({
        title: document.getElementById("pageTitle")?.textContent || "",
        count: document.getElementById("pageCount")?.textContent || "",
        navCount: document.querySelectorAll(".nav-item").length,
        missionMode: document.getElementById("contentShell")?.classList.contains("mission-mode") || false,
        paperMode: document.getElementById("contentShell")?.classList.contains("paper-mode") || false,
        challengeCount: document.querySelectorAll(".challenge-card").length,
        optionCount: document.querySelectorAll(".mission-option").length,
        activeMission: document.querySelector(".mission-tab.active")?.textContent.trim() || "",
        paperCardCount: document.querySelectorAll(".paper-card").length,
        paperOutputCount: document.querySelectorAll(".paper-output").length,
        a1Title: document.querySelector(".a1-title")?.textContent.trim() || "",
        bodyWidth: document.body.scrollWidth,
        viewportWidth: innerWidth
      }));

      assert(errors.length === 0, `${testCase.name} has browser errors: ${errors.join(" | ")}`);
      assert(state.navCount === 19, `${testCase.name} expected 19 nav items, got ${state.navCount}`);
      assert(state.count.endsWith("/ 19"), `${testCase.name} expected page count / 19, got ${state.count}`);
      assert(state.missionMode === testCase.expectMission, `${testCase.name} mission mode mismatch`);
      assert(state.paperMode === Boolean(testCase.expectPaper), `${testCase.name} paper mode mismatch`);
      assert(state.bodyWidth <= state.viewportWidth + 2, `${testCase.name} has horizontal overflow`);

      if (testCase.expectMission) {
        assert(state.challengeCount === 6, `${testCase.name} expected 6 challenges`);
        assert(state.optionCount === 24, `${testCase.name} expected 24 options`);
        assert(state.activeMission === testCase.active, `${testCase.name} active mission mismatch: ${state.activeMission}`);
      }

      if (testCase.expectPaper) {
        assert(state.a1Title.includes("四川某地市政务服务中心"), `${testCase.name} missing A1 sample title`);
        assert(state.paperCardCount === 4, `${testCase.name} expected 4 paper cases, got ${state.paperCardCount}`);
        assert(state.paperOutputCount === 28, `${testCase.name} expected 28 paper output blocks, got ${state.paperOutputCount}`);
      }

      if (shouldScreenshot) {
        await page.screenshot({
          path: path.join(path.dirname(path.resolve(input)), `private_network_demo_v3_${testCase.name}.png`),
          fullPage: false
        });
      }

      await page.close();
      console.log(`OK ${testCase.name}: ${state.title}`);
    }

    const interaction = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await interaction.goto(withQuery(baseUrl, "?mission=finance"), { waitUntil: "networkidle" });
    await interaction.click(".mission-option[data-challenge-id=arch][data-option-id=dual_dc]");
    const clicked = await interaction.evaluate(() => ({
      selected: document.querySelectorAll(".mission-option.selected").length,
      activeMission: document.querySelector(".mission-tab.active")?.textContent.trim() || ""
    }));
    assert(clicked.activeMission === "四川金融", "interaction test did not stay on finance mission");
    assert(clicked.selected >= 1, "interaction test did not select an option");
    await interaction.close();
    console.log("OK mission interaction: option selection works");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(`FAILED ${error.message}`);
  process.exit(1);
});
