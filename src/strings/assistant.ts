import type { NoticeCode, Question } from '../utils/groundedAssistant';

export const assistantEn = {
  title: 'Daily assistant', back: 'Back to home',
  scope: 'Answers use saved people, follow-ups and responsibilities on this device. Personal Notebook and external accounts are not searched.',
  questions: {
    today: 'What do I need to remember today?', contact: 'Who should I contact today?',
    'last-interaction': 'When was the last recorded interaction?', commitments: 'What commitments have I recorded?',
    overdue: 'Which responsibilities and follow-ups are overdue?', upcoming: 'What is approaching in the next seven calendar days?',
  } satisfies Record<Question, string>,
  statuses: { results: 'Matching saved records', none: 'No matching saved records for this question.',
    unknown: 'There is not enough recorded information to answer fully.', ambiguous: 'Choose the person you mean.',
    unavailable: 'Responsibilities are unavailable. This answer cannot be checked completely.' },
  notices: {
    'person-query-required': 'Enter a name to look up a person.', 'person-not-found': 'No saved person matches this selection.',
    'multiple-people-match': 'Several people match. Select one; no match has been assumed.',
    'no-interactions-recorded': 'No interactions are recorded for this person. This does not mean you have never spoken.',
    'interaction-dates-unknown': 'Some saved interactions have no reliable date.',
    'newest-interaction-unknown': 'Undated interactions prevent confirming which interaction was most recent.',
    'future-interactions-need-review': 'Future-dated interactions need review and are not treated as past contact.',
    'follow-up-dates-missing': 'Some open follow-ups have no reminder date. Their timing is unknown.',
    'follow-up-dates-invalid': 'Some open follow-up dates need review and cannot be placed on the calendar.',
    'life-dates-invalid': 'Some responsibility dates need review.',
    'life-records-loading': 'Responsibilities are still loading.', 'life-records-unavailable': 'Saved responsibilities could not be read safely.',
    'follow-ups-not-verified-promises': 'These are saved open follow-ups. The records do not separately verify promises.',
    'contact-based-on-saved-follow-ups': 'Contact suggestions come only from saved follow-ups due today or earlier.',
  } satisfies Record<NoticeCode, string>,
  personQuery: 'Find a person by name', sourceTypes: { interaction: 'Recorded interaction', 'follow-up': 'Open follow-up', 'life-record': 'Responsibility' },
  missingDate: 'Date not recorded', calendarDate: 'Calendar date', instantDate: 'Date and time',
  openPerson: 'Open person', openLife: 'Open responsibility', reload: 'Reload responsibilities',
  nextSeven: 'The next seven calendar days include today and the following six local dates.',
  showMore: 'Show more sources', showing: (shown: number, total: number) => `Showing ${shown} of ${total} saved sources`,
};

export const assistantTr: typeof assistantEn = {
  title: 'Günlük asistan', back: 'Ana sayfaya dön',
  scope: 'Yanıtlar bu cihazdaki kayıtlı kişileri, takipleri ve sorumlulukları kullanır. Kişisel Defter ve harici hesaplar aranmaz.',
  questions: {
    today: 'Bugün neleri hatırlamalıyım?', contact: 'Bugün kimlerle iletişim kurmalıyım?',
    'last-interaction': 'Son kayıtlı etkileşim ne zamandı?', commitments: 'Hangi taahhütleri kaydettim?',
    overdue: 'Hangi sorumluluklar ve takipler gecikti?', upcoming: 'Önümüzdeki yedi takvim gününde neler yaklaşıyor?',
  },
  statuses: { results: 'Eşleşen kayıtlar', none: 'Bu soru için eşleşen kayıt yok.',
    unknown: 'Tam yanıt için yeterli kayıtlı bilgi yok.', ambiguous: 'Kastettiğiniz kişiyi seçin.',
    unavailable: 'Sorumluluklara erişilemiyor. Bu yanıtın tamamı kontrol edilemiyor.' },
  notices: {
    'person-query-required': 'Bir kişiyi aramak için adını girin.', 'person-not-found': 'Bu seçime uyan kayıtlı kişi yok.',
    'multiple-people-match': 'Birden fazla kişi eşleşiyor. Birini seçin; otomatik seçim yapılmadı.',
    'no-interactions-recorded': 'Bu kişi için kayıtlı etkileşim yok. Bu, hiç konuşmadığınız anlamına gelmez.',
    'interaction-dates-unknown': 'Bazı kayıtlı etkileşimlerin güvenilir tarihi yok.',
    'newest-interaction-unknown': 'Tarihsiz etkileşimler nedeniyle en son etkileşim kesinleştirilemiyor.',
    'future-interactions-need-review': 'Gelecek tarihli etkileşimler incelenmeli; geçmiş iletişim sayılmazlar.',
    'follow-up-dates-missing': 'Bazı açık takiplerin hatırlatma tarihi yok. Zamanları bilinmiyor.',
    'follow-up-dates-invalid': 'Bazı açık takip tarihleri incelenmeli; takvime yerleştirilemiyor.',
    'life-dates-invalid': 'Bazı sorumluluk tarihleri incelenmeli.',
    'life-records-loading': 'Sorumluluklar hâlâ yükleniyor.', 'life-records-unavailable': 'Kayıtlı sorumluluklar güvenle okunamadı.',
    'follow-ups-not-verified-promises': 'Bunlar kayıtlı açık takiplerdir. Kayıtlar, verilen sözleri ayrıca doğrulamaz.',
    'contact-based-on-saved-follow-ups': 'İletişim önerileri yalnızca bugün veya daha önce yapılması planlanan kayıtlı takiplerden gelir.',
  },
  personQuery: 'Adıyla kişi ara', sourceTypes: { interaction: 'Kayıtlı etkileşim', 'follow-up': 'Açık takip', 'life-record': 'Sorumluluk' },
  missingDate: 'Tarih kaydedilmemiş', calendarDate: 'Takvim tarihi', instantDate: 'Tarih ve saat',
  openPerson: 'Kişiyi aç', openLife: 'Sorumluluğu aç', reload: 'Sorumlulukları yeniden yükle',
  nextSeven: 'Yedi takvim günü, bugün ve onu izleyen altı yerel tarihi kapsar.',
  showMore: 'Daha fazla kaynak göster', showing: (shown, total) => `${total} kayıtlı kaynaktan ${shown} tanesi gösteriliyor`,
};

export function assistantCopy(locale: string) { return locale.toLowerCase().startsWith('tr') ? assistantTr : assistantEn; }
