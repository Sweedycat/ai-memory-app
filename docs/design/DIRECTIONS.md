# Visual direction decision — V3 Milestone B

Status: **all three directions founder-approved, 2026-11-20; implementation pending**. No application styles,
navigation, theme preference, production feature or personal record changed.
These are static illustrations with fabricated data, not device screenshots or
evidence of Android acceptance. No Notebook/cloud/backup/security activation is
shown. View the [comparison](comparison.png), [editable vector comparison](comparison.svg)
or each direction at full size below.

| Direction | Preview | Tradeoff |
| --- | --- | --- |
| A — Existing identity refined | [Near-black/mint](direction-a.svg) | Lowest visual migration risk; retains recognizable mint and rounded cards. Dark-only proposal remains less useful in bright conditions |
| B — Premium modern dark | [Navy/periwinkle](direction-b.svg) | More distinct contemporary appearance; changes the familiar mint identity. Premium describes appearance, not paid features |
| C — Coordinated light/dark | [Light](direction-c.svg), [matching dark](direction-c-dark.svg) | Daylight and user-preference coverage; largest theme/native-control verification scope |

The founder approved all three, rather than choosing only one. A is the default
classic black/mint; B is modern navy/periwinkle dark; C supplies coordinated
light/dark palettes. System mode follows device appearance through C's palettes.
All theme choices are permanently free for Free/Plus/Pro users. Implement Settings
→ Appearance → Theme with previews, immediate application and safe persistence.
One shared design/component system must serve all modes and every future feature;
never duplicate screens or tie appearance to an entitlement. No individual screen
adopts a different identity independently. Approval does not establish device or
commercial acceptance; different future visual directions still need approval.

## Shared layout and behavior

All proposals preserve the same synthetic content, order, destinations and
record actions. They compare palette/radii rather than introducing new features.
The continuation below each phone illustrates the same scrolled content; it is
not an extra app screen. The bottom header specimen shows a compact visual Back
control with a 48-unit touch target, rather than a full-width primary button.

- System font only; no downloads or new icon package. Target hero30/36,
  screen24/30, section20/28, card18/26, body/input/button16/24, metadata14/20.
- One 20dp gutter, 16dp card padding, 8dp internal gaps, 12dp card gaps and 24dp
  section spacing. Cards fill available width; controls use minHeight48 rather
  than fixed heights so translated/scaled text can wrap.
- Consistent 24dp line icons and explicit selected/focus/disabled/error states.
  Never encode overdue or selection state using color alone.
- Runtime top/bottom safe insets should be applied once when implementation is
  authorized. Keyboard focus/actions, gesture/3-button navigation, font scaling
  and TalkBack require actual device checks; these SVGs cannot prove them.
- App-controlled labels need complete TR/EN coverage; user records are never
  automatically translated. Translating this mockup does not localize the app.

| Token | A | B | C light / dark |
| --- | --- | --- | --- |
| Background | #0B0F14 | #0C1018 | #F4F7F6 / #101A16 |
| Card | #121820 | #151D2B | #FFFFFF / #19251F |
| Input | #0E141B | #101724 | #EDF3F1 / #122019 |
| Control boundary | #607282 | #697D95 | #758C84 / #698276 |
| Main text | #F4F7FA | #F3F6FC | #152720 / #F1F7F3 |
| Secondary text | #AAB5C0 | #B5C0D2 | #4E655C / #B1C4B8 |
| Accent | #7DE2C3 | #B6C4FF | #176B54 / #8BDAB4 |
| Text on accent | #07100D | #152045 | #FFFFFF / #092A1B |
| Card/control radius | 20 / 14dp | 16 / 12dp | 16 / 12dp |

The UI/UX engineer calculated secondary-text/card contrast A8.56:1, B9.20:1,
C-light6.29:1, C-dark8.64:1; action text/fill12.43/9.31/6.43/9.41:1;
control boundaries3.59/4.00/3.60/3.81:1. These are palette mathematics, not a
rendered accessibility certification. The illustrations are XML-validated;
the comparison PNG was rendered with the already bundled local renderer and
visually inspected. No package installation, external font or image service.

## Focused later acceptance checklist (Turkish)

This applies to the later approved UI increment, not a request to install now:

- TR ve EN'de değişen ekranlar/diyaloglar tek dilde; mevcut kişi ve ajanda
  kayıtları aynı kalır. Kişisel verileri ekran görüntülerine ekleme.
- Geri düğmesi görsel olarak küçük, dokunma alanı yeterli; beklenen önceki
  ekrana gider ve kaydedilmemiş düzenlemeyi sessizce kaybetmez.
- Samsung Galaxy S26 Ultra'da durum/gezinme çubukları, klavye, büyük yazı ve
  TalkBack altında metin/eylemler erişilebilir; kartlar ve boşluklar tutarlı.
- Seçilen yönde desteklenen temalar tutarlı; yeni tema ayarı gerçekten
  uygulanmadan aktif hizmet gibi sunulmaz.
- Etkilenen hata/izin/kilit akışları hedefli kontrol edilir; daha önce başarılı
  bütün manuel senaryolar sırf bu görsel değişiklik için tekrarlanmaz.
