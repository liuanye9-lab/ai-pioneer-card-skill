import type { CardIntentResult, OperationCopy, SourceOfTruth } from "../core/types.js";

/**
 * Operation Copy Generator (PRD §9.23-9.24, DESIGN §33, SKILL §30-31).
 *
 * Produces contextual, natural group-chat copy for before/on/after send plus a
 * deadline reminder. It must NOT restate the card verbatim, must be short, and
 * must avoid "公众号腔" / AI-腔 / emoji spam.
 */

export function generateOperationCopy(sot: SourceOfTruth, intent: CardIntentResult): OperationCopy {
  const deadline = sot.deadlines[0]?.date ?? sot.dates[0]?.value;
  const action = sot.actions[0]?.action ?? intent.primary_action;
  // Personalize with the real activity name + a scene keyword (never invent).
  const name = sot.activity_name ?? "";
  const namePrefix = name ? `${name} ` : "";
  const scene = name || "这个";

  switch (intent.primary_intent) {
    case "submission":
    case "deadline":
      return {
        beforeSend: `还没交作品的同学重点看下这张卡，今天先把${name || "作品"}可提交版本准备好。`,
        onSend: `${action}的入口在卡片里，直接点就行。`,
        afterSend: "有卡在提交环节的，直接群里发出来，我帮忙看一下。",
        deadlineReminder: deadline
          ? `${deadline}就截止了，还没交的抓紧，别等最后一小时。`
          : "临近截止了，还没交的抓紧。",
        beforeSendLively: `朋友们，${namePrefix}作品提交通道开啦！${deadline ? `${deadline}截止，` : ""}想冲奖的抓紧交，别到最后一刻挤破头 🚀`,
      };

    case "training":
      return {
        beforeSend: "前面群里问怎么搭的比较多，这场刚好会集中讲，做实操的建议来听。",
        onSend: "课程入口放卡片里了，按需约对应专场。",
        afterSend: "听完有具体问题的可以群里抛，我们对着场景聊。",
        deadlineReminder: "今晚这场快开始了，先把入口点进去别错过。",
        beforeSendLively: `朋友们，${namePrefix}这场干货别错过！名额有限，先约先得，做实操的冲就完了 🔥`,
      };

    case "case_showcase":
      return {
        beforeSend: "做类似场景的同学可以重点看这个案例，里面的拆法挺值得参考。",
        onSend: "案例详情在卡片按钮里，感兴趣的点进去看完整拆解。",
        afterSend: "看完如果想套到自己的场景，群里说下你的需求，我们一起对。",
        deadlineReminder: "",
        beforeSendLively: `朋友们快来看看这个${scene}案例！同款场景的照着抄作业就行 👀`,
      };

    case "result":
    case "award":
      return {
        beforeSend: "结果出来了，先恭喜进入下一阶段的同学。",
        onSend: "名单在卡片里，对照看下自己的状态。",
        afterSend: "进入下一阶段的同学注意后续安排，我们会陆续同步。",
        deadlineReminder: "",
        beforeSendLively: `${namePrefix}结果公布啦！快看看有没有你 🎉 恭喜上榜的同学！`,
      };

    case "timeline":
      return {
        beforeSend: "把整个赛程节点理了一版，先收藏这张卡，按节点推进就不会漏。",
        onSend: "当前在哪个节点、下一步做什么，卡片上标出来了。",
        afterSend: "对某个节点的要求不清楚的，群里问，我补充说明。",
        deadlineReminder: deadline ? `下一个关键节点是${deadline}，提前准备。` : "关注下一个关键节点。",
        beforeSendLively: `朋友们，${namePrefix}完整赛程出炉！先收藏这张卡，跟着节点走稳稳不踩坑 📌`,
      };

    default:
      return {
        beforeSend: "有条新的活动信息，简单同步下。",
        onSend: "详情在卡片里，花一分钟看下和自己是否相关。",
        afterSend: "有问题群里直接说。",
        deadlineReminder: deadline ? `注意${deadline}这个时间点。` : "",
        beforeSendLively: `朋友们，${namePrefix}有个新消息，花一分钟看看和你相关不 👀`,
      };
  }
}
