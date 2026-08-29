import { describe, it, expect } from "vitest";
import { parseSourceOfTruth } from "../src/parser/fact-parser.js";
import { routeCardIntent } from "../src/intent/card-intent-router.js";
import { routeImageIntent } from "../src/intent/image-intent-router.js";
import { routeRenderMode } from "../src/intent/render-mode-router.js";

function route(copy: string) {
  const sot = parseSourceOfTruth({ copy });
  const intent = routeCardIntent(sot, copy);
  const imageIntent = routeImageIntent(sot, intent, copy);
  const renderMode = routeRenderMode(sot, intent, imageIntent);
  return { sot, intent, imageIntent, renderMode };
}

describe("intent + render-mode routers", () => {
  it("classifies submission as submission + text_first", () => {
    const { intent, renderMode } = route(
      "AI先锋大赛 9月4日作品提交截止，提交地址：https://example.com",
    );
    expect(intent.primary_intent).toBe("submission");
    expect(renderMode.render_mode).toBe("text_first");
  });

  it("classifies a pure deadline as text_first (no image)", () => {
    const { renderMode, imageIntent } = route("AI先锋大赛 作品提交9月4日截止，记得提交");
    expect(renderMode.render_mode).toBe("text_first");
    expect(imageIntent.image_mode).toBe("not_needed");
  });

  it("selects image_led_navigation for multi-series multi-scene training (GT-04 / MGT-01)", () => {
    const copy = `本周两个培训系列：
飞书直播大班课，周一到周五15:00-16:00
豆包工作系列，周一到周五14:00-15:00
包含财务、销售、客服专题
提供课程日历和对应专题入口`;
    const { renderMode, imageIntent } = route(copy);
    expect(renderMode.render_mode).toBe("image_led_navigation");
    expect(["schedule_overview", "scene_navigation"]).toContain(imageIntent.image_role);
  });

  it("recommends an assisted image for a case showcase", () => {
    const { renderMode } = route("分享一个销售场景的优秀案例，Agent 拆法值得参考");
    expect(["image_assisted", "image_led_navigation"]).toContain(renderMode.render_mode);
  });

  it("falls back to announcement on weak signals", () => {
    const { intent } = route("AI先锋大赛，同步一条信息");
    expect(intent.primary_intent).toBe("announcement");
  });
});
