export const timeEntryEn = {
  title: 'Reminder time', hour: 'Hour', minute: 'Minute',
  hourHint: 'Enter an hour from 00 to 23. Next moves to minutes.',
  minuteHint: 'Enter minutes from 00 to 59, then confirm the time.',
  format: '24-hour time · HH:MM', confirm: 'Confirm time', cancel: 'Cancel',
  invalidHour: 'Enter an hour from 00 to 23.', invalidMinute: 'Enter minutes from 00 to 59.',
  invalidDate: 'Choose a valid reminder date before entering a time.',
  unavailableTime: 'This time does not exist on the selected date in your current time zone. Choose another time.',
};

export const timeEntryTr: typeof timeEntryEn = {
  title: 'Hatırlatma saati', hour: 'Saat', minute: 'Dakika',
  hourHint: '00 ile 23 arasında bir saat girin. İleri, dakika alanına geçer.',
  minuteHint: '00 ile 59 arasında bir dakika girin, ardından saati onaylayın.',
  format: '24 saat biçimi · SS:DD', confirm: 'Saati onayla', cancel: 'Vazgeç',
  invalidHour: '00 ile 23 arasında bir saat girin.', invalidMinute: '00 ile 59 arasında bir dakika girin.',
  invalidDate: 'Saat girmeden önce geçerli bir hatırlatma tarihi seçin.',
  unavailableTime: 'Bu saat, seçilen tarihte mevcut saat diliminizde bulunmuyor. Başka bir saat seçin.',
};
