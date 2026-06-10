/**
 * 将简易 glob 模式转换为正则表达式。
 * 支持：* (非路径分隔符)、** (任意路径)、? (单字符)、{a,b} (选择组)
 */
export function globToRegex(glob: string): RegExp {
  let out = '^';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        out += '.*';
        i += 2;
      } else {
        out += '[^/]*';
        i++;
      }
    } else if (c === '?') {
      out += '.';
      i++;
    } else if (c === '{') {
      const end = glob.indexOf('}', i);
      if (end < 0) {
        out += '\\{';
        i++;
      } else {
        const opts = glob.slice(i + 1, end)
          .split(',')
          .map((x) => x.replace(/[.+^$()|[\]\\]/g, '\\$&'));
        out += '(?:' + opts.join('|') + ')';
        i = end + 1;
      }
    } else if (/[.+^$()|[\]\\]/.test(c)) {
      out += '\\' + c;
      i++;
    } else {
      out += c;
      i++;
    }
  }
  out += '$';
  return new RegExp(out);
}
