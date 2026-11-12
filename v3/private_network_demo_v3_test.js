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
  if (baseUrl.startsWith("file:")) {
    const htmlSource = fs.readFileSync(new URL(baseUrl), "utf8");
    assert(!/(www\.kdocs\.cn|365\.kdocs\.cn|link_id|token)/i.test(htmlSource), "HTML source leaks KDocs links, link_id, or token text");
  }

  const browser = await chromium.launch({ headless: true });
  const cases = [
    { name: "page-01", query: "?page=1", expectMission: false },
    { name: "page-03-security", query: "?page=3", expectMission: false, expectText: "固定公网 IP 暴露" },
    { name: "page-10-government", query: "?page=10", expectMission: false, expectText: "行政层级", expectTopologyClass: "gov-layer-topology" },
    { name: "page-11-justice", query: "?page=11", expectMission: false, expectText: "分域隔离", expectTopologyClass: "justice-domain-topology" },
    { name: "page-12-finance", query: "?page=12", expectMission: false, expectText: "双中心", expectTopologyClass: "finance-ring-topology" },
    { name: "page-13-manufacturing", query: "?page=13", expectMission: false, expectText: "IT/OT", expectTopologyClass: "manufacturing-factory-topology" },
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
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        promptCount: document.querySelectorAll(".tag.question").length,
        answerTop: document.querySelector("#answerZone")?.getBoundingClientRect().top || 0,
        answerTagCount: document.querySelectorAll(".answer-tag").length,
        topologyClasses: ["gov-layer-topology", "justice-domain-topology", "finance-ring-topology", "manufacturing-factory-topology"]
          .filter(className => document.querySelector(`.${className}`)),
        bodyText: document.body.innerText
      }));

      assert(errors.length === 0, `${testCase.name} has browser errors: ${errors.join(" | ")}`);
      assert(state.navCount === 19, `${testCase.name} expected 19 nav items, got ${state.navCount}`);
      assert(state.count.endsWith("/ 19"), `${testCase.name} expected page count / 19, got ${state.count}`);
      assert(state.missionMode === testCase.expectMission, `${testCase.name} mission mode mismatch`);
      assert(state.paperMode === Boolean(testCase.expectPaper), `${testCase.name} paper mode mismatch`);
      assert(state.bodyWidth <= state.viewportWidth + 2, `${testCase.name} has horizontal overflow`);

      if (!testCase.expectMission && !testCase.expectPaper) {
        assert(state.promptCount >= 3, `${testCase.name} expected at least 3 classroom prompt chips`);
        assert(state.answerTagCount >= 3, `${testCase.name} expected answer tags in the teaching detail zone`);
        assert(state.answerTop > state.viewportHeight - 4, `${testCase.name} answer zone is visible in the first viewport`);
        await page.locator("#answerZone").scrollIntoViewIfNeeded();
        await page.waitForTimeout(120);
        const answerState = await page.evaluate(() => ({
          compareTop: document.querySelector("#compareCard")?.getBoundingClientRect().top || 9999,
          compareText: document.querySelector("#compareCard")?.innerText || ""
        }));
        assert(answerState.compareTop < state.viewportHeight, `${testCase.name} answer zone did not appear after scrolling`);
        assert(answerState.compareText.includes("讲解区"), `${testCase.name} answer zone missing teaching source note`);
      }

      if (testCase.expectText) {
        assert(state.bodyText.includes(testCase.expectText), `${testCase.name} missing expected text: ${testCase.expectText}`);
      }

      if (testCase.expectTopologyClass) {
        assert(state.topologyClasses.includes(testCase.expectTopologyClass), `${testCase.name} missing topology class ${testCase.expectTopologyClass}`);
      }

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
