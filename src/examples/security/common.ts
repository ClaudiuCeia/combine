export function oneline(
  strings: TemplateStringsArray,
  ...placeholders: TemplateStringsArray[]
) {
  const spaced = strings.reduce(
    (result, string, i) => result + placeholders[i - 1] + string
  );
  return spaced.replace(/\s\s+/g, " ");
}
