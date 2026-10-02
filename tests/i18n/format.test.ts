import { formatTime } from '../../src/i18n/format';
import { LOCALES } from '../../src/i18n/locales';
import { intlLocale } from '../../src/i18n/format';

describe('formatTime', () => {
  it('matches Intl formatting in every supported locale', () => {
    for (const { code } of LOCALES) {
      for (const ms of [0, 9_000, 65_000, 599_999, 3_600_000, 3_725_000, 36_000_000]) {
        const total = Math.floor(ms / 1000);
        const two = new Intl.NumberFormat(intlLocale(code), { minimumIntegerDigits: 2 });
        const h = Math.floor(total / 3600);
        const expected =
          h > 0
            ? `${new Intl.NumberFormat(intlLocale(code)).format(h)}:${two.format(Math.floor((total % 3600) / 60))}:${two.format(total % 60)}`
            : `${two.format(Math.floor(total / 60))}:${two.format(total % 60)}`;
        expect(formatTime(ms, code), `${code} ${ms}`).toBe(expected);
      }
    }
  });
});
