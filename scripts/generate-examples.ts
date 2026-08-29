import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "../src/core/pipeline.js";
import { writeBundle } from "../src/output/bundle-writer.js";
import type { RawInput } from "../src/core/types.js";

/**
 * Generates one full output bundle per canonical scenario into examples/.
 * Run: npm run examples
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const BRANDS_DIR = resolve(PROJECT_ROOT, "brands");
const EXAMPLES_DIR = resolve(PROJECT_ROOT, "examples");

interface Scenario {
  slug: string;
  input: RawInput;
}

const scenarios: Scenario[] = [
  {
    slug: "01-submission-golden",
    input: {
      slug: "01-submission-golden",
      copy: `AI先锋大赛
9月4日作品提交截止
还没提交作品的小伙伴记得尽快提交
提交地址：https://example.com/submit
作品提交将在9月4日截止
📣 大家记得不要错过`,
    },
  },
  {
    slug: "02-deadline",
    input: {
      slug: "02-deadline",
      copy: `AI先锋大赛 初赛作品提交⏰将在0904截止，作品需包含 Agent 拆解说明，提交入口：https://example.com/submit`,
    },
  },
  {
    slug: "03-timeline",
    input: {
      slug: "03-timeline",
      copy: `AI先锋大赛赛程安排：
8.20 报名启动
8.28 初赛作品提交
9.4 初赛评审
9.10 决赛路演
完整赛程见：https://example.com/timeline`,
    },
  },
  {
    slug: "04-training",
    input: {
      slug: "04-training",
      copy: `本周 AI先锋大赛训练营：飞书多维表实战专场，周四 20:00-21:00 开讲，讲怎么搭自动化流程。预约直播：https://example.com/live`,
    },
  },
  {
    slug: "05-image-assisted-case",
    input: {
      slug: "05-image-assisted-case",
      copy: `AI先锋大赛优秀案例推荐：一个销售场景的 Agent 拆解，把线索清洗、跟进、纪要自动化串起来，效果不错。查看完整案例：https://example.com/case`,
    },
  },
  {
    slug: "06-image-led-navigation",
    input: {
      slug: "06-image-led-navigation",
      copy: `本周两个培训系列已就位：
飞书直播大班课，周一到周五 15:00-16:00，一周学会用飞书
豆包工作系列，周一到周五 14:00-15:00，分财务、销售、客服专场
查看课程日历：https://example.com/calendar`,
    },
  },
  {
    slug: "07-xiangshanghui-result",
    input: {
      slug: "07-xiangshanghui-result",
      brandName: "象上汇",
      copy: `象上汇先锋大赛决赛名单公布，8强正式产生，恭喜晋级的选手，决赛路演9月10日进行，名单详情：https://example.com/finalists`,
    },
  },
];

let failures = 0;
for (const s of scenarios) {
  const result = compile(s.input, { brandsDir: BRANDS_DIR });
  const dir = writeBundle(EXAMPLES_DIR, result);
  const flag = result.qa.pass && !result.qa.hardFail ? "✅" : "⚠️";
  if (!result.qa.pass || result.qa.hardFail) failures += 1;
  console.log(
    `${flag} ${s.slug.padEnd(28)} intent=${result.intent.primary_intent.padEnd(13)} mode=${result.renderMode.render_mode.padEnd(22)} score=${result.qa.score.total} hardFail=${result.qa.hardFail} -> ${dir}`,
  );
}

console.log(`\n${scenarios.length} bundles generated, ${failures} with QA issues.`);
