/**
 * Local Card JSON 2.0 schema validation (SPEC §15/§25).
 *
 * This is a structural sanity check against the documented Card JSON 2.0
 * shape — NOT a replacement for server-side validation. It guards the most
 * common breakages (missing schema, malformed button behaviors, empty body).
 */

export interface CardValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const VALID_TEMPLATES = new Set([
  "blue", "wathet", "turquoise", "green", "yellow", "orange",
  "red", "carmine", "violet", "purple", "indigo", "grey", "default",
]);

export function validateCardJson(card: any): CardValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!card || typeof card !== "object") {
    return { valid: false, errors: ["card is not an object"], warnings };
  }

  if (card.schema !== "2.0") errors.push(`schema must be "2.0" (got ${JSON.stringify(card.schema)})`);

  if (!card.header) {
    errors.push("missing header");
  } else {
    const t = card.header.title;
    // Card JSON 2.0 header.title supports plain_text only (not lark_md).
    if (!t || t.tag !== "plain_text" || typeof t.content !== "string") {
      errors.push("header.title must be { tag: plain_text, content: string }");
    }
    if (card.header.template && !VALID_TEMPLATES.has(card.header.template)) {
      errors.push(`header.template invalid: ${card.header.template}`);
    }
  }

  if (!card.body || !Array.isArray(card.body.elements)) {
    errors.push("body.elements must be an array");
  } else {
    if (card.body.elements.length === 0) warnings.push("body has no elements");
    card.body.elements.forEach((el: any, i: number) => validateElement(el, `body.elements[${i}]`, errors, warnings));
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateElement(el: any, path: string, errors: string[], warnings: string[]): void {
  if (!el || typeof el.tag !== "string") {
    errors.push(`${path}: element missing tag`);
    return;
  }
  switch (el.tag) {
    case "button": {
      if (!el.text || typeof el.text.content !== "string") errors.push(`${path}: button.text.content required`);
      if (!Array.isArray(el.behaviors) || el.behaviors.length === 0) {
        errors.push(`${path}: interactive button requires at least one behavior`);
      } else {
        el.behaviors.forEach((b: any, j: number) => {
          if (b.type === "open_url") {
            // 2.0 requires default_url; a bare `url` is non-standard and no-ops.
            if (!b.default_url) errors.push(`${path}.behaviors[${j}]: open_url requires default_url`);
          } else if (b.type === "callback") {
            if (typeof b.value !== "object" || b.value === null || Array.isArray(b.value))
              errors.push(`${path}.behaviors[${j}]: callback requires a non-null value object`);
          } else {
            warnings.push(`${path}.behaviors[${j}]: unknown behavior type ${b.type}`);
          }
        });
      }
      break;
    }
    case "markdown":
      if (typeof el.content !== "string") errors.push(`${path}: markdown.content required`);
      break;
    case "div":
      if (!el.text || typeof el.text.content !== "string") errors.push(`${path}: div.text.content required`);
      break;
    case "img":
      if (typeof el.img_key !== "string" || el.img_key.length === 0)
        errors.push(`${path}: img.img_key required (upload asset first)`);
      break;
    case "column_set":
      if (!Array.isArray(el.columns)) errors.push(`${path}: column_set.columns must be array`);
      else {
        // Mobile-first: a card should never crowd 3+ columns in a row.
        if (el.columns.length > 2) warnings.push(`${path}: column_set has ${el.columns.length} columns (mobile: keep ≤ 2)`);
        el.columns.forEach((col: any, j: number) => {
          if (col.tag !== "column") errors.push(`${path}.columns[${j}]: expected tag column`);
          if (!Array.isArray(col.elements)) errors.push(`${path}.columns[${j}].elements must be array`);
          else col.elements.forEach((ce: any, k: number) => validateElement(ce, `${path}.columns[${j}].elements[${k}]`, errors, warnings));
        });
      }
      break;
    case "hr":
      break;
    default:
      warnings.push(`${path}: unrecognized tag "${el.tag}" (may still be valid)`);
  }
}
