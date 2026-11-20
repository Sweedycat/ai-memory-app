/** Local generated interface text only; personal record values pass through unchanged. */
export const generatedEn = {
  unknownDate: 'Date not recorded',
  dateTime: (date: string, time: string) => `${date} · ${time}`,
  briefing: {
    identitySeparator: ' at ',
    identity: (name: string, identity: string) => `${name}${identity ? ` is ${identity}` : ''}.`,
    context: (relationship: string) => `Context: ${relationship}.`,
    dated: (date: string, summary: string) => `Last dated interaction (${date}): ${summary}`,
    undated: (summary: string) => `Saved interaction (date not recorded): ${summary}`,
    future: (summary: string) => `Saved interaction (future date, needs review): ${summary}`,
    uncertainDates: 'Some interaction dates are not recorded; the latest interaction cannot be confirmed.',
    futureReview: 'Future-dated interactions need review.',
    remember: (notes: string) => `Remember: ${notes}`,
    nextStep: (text: string) => `Next step: ${text}.`,
  },
};

export const generatedTr: typeof generatedEn = {
  unknownDate: 'Tarih kaydedilmedi',
  dateTime: (date: string, time: string) => `${date} · ${time}`,
  briefing: {
    identitySeparator: ' · ',
    identity: (name: string, identity: string) => `${name}${identity ? ` — ${identity}` : ''}.`,
    context: (relationship: string) => `Bağlam: ${relationship}.`,
    dated: (date: string, summary: string) => `Son tarihli etkileşim (${date}): ${summary}`,
    undated: (summary: string) => `Kayıtlı etkileşim (tarih kaydedilmedi): ${summary}`,
    future: (summary: string) => `Kayıtlı etkileşim (gelecek tarihli, incelenmeli): ${summary}`,
    uncertainDates: 'Bazı etkileşimlerin tarihi kaydedilmemiş; en son etkileşim doğrulanamıyor.',
    futureReview: 'Gelecek tarihli etkileşimler incelenmeli.',
    remember: (notes: string) => `Hatırla: ${notes}`,
    nextStep: (text: string) => `Sonraki adım: ${text}.`,
  },
};

/** Standalone selection avoids importing providers or the aggregate catalog into utilities. */
export function generatedCopy(locale?: string): typeof generatedEn {
  return locale?.toLowerCase().startsWith('tr') ? generatedTr : generatedEn;
}
