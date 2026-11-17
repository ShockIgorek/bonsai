// Маппинг: имя задачи → имя файла в assets/
export const TASK_IMAGE_MAP = {
  'помыть посуду': 'dishes',
  'столы протереть': 'table',
  'в шкафах разобраться': 'cabinet',
  'в холодильнике прибрать': 'fridge',
  'со столов убрать все нахуй': 'livingroom',
  'подоконник протереть': 'window',
  'убрать срач с дивана': 'livingroom',
  'рабочий стол в чистоте': 'table',
  'постельку заправить': 'bedroom',
  'в шкафах все красиво': 'cabinet',
  'гитары поставить': 'guitar',
  'с проводами разобраться': 'cabinet',
  'полы помыть': 'livingroom',
  'протеиновый коктейль': 'gym',
  'рыбка': 'dishes',
  'яйца': 'dishes',
  'курочка': 'dishes',
  'водичка': 'tea',
  'фрукты овощи': 'dishes',
  'силовые тренировки': 'gym',
  'растяжка': 'gym',
  'кардио': 'gym',
  'гуляем побольше': 'window',
  'режим': 'bedroom',
  'альбом записать': 'guitar',
  'программу подготовить': 'guitar',
  'этюду учить': 'guitar',
  'снимать видосики': 'window',
  'чай выпить': 'tea',
  'винильчик включить': 'vinyl',
  'в плойку поиграть': 'livingroom',
  'сериальчик позырить': 'livingroom',
  'книжку почитать': 'bedroom',
  'откладывать': 'table',
  'закрывать кредит': 'table',
  'сходить куда-нибудь': 'livingroom',
  'маме позвонить': 'window',
  'узнать как дела у бабушки': 'window',
  'доебаться до Сереги': 'window'
};

// Фоллбэк-имена для веток (на будущее — если в навигации захочешь показать превью ветки)
export const BRANCH_IMAGE_MAP = {
  'дом': 'livingroom',
  'кухня': 'table',
  'зал': 'livingroom',
  'комната': 'bedroom',
  'здоровье': 'gym',
  'кушаем хорошо': 'dishes',
  'побольше белка': 'gym',
  'спортом занимаемся': 'gym',
  'творчество': 'guitar',
  'отдых': 'vinyl',
  'бабки': 'table',
  'общение': 'window',
  'проживем как нибудь': 'placeholder'
};

export function getTaskImage(taskName, fallback = 'placeholder') {
  const slug = TASK_IMAGE_MAP[taskName] || BRANCH_IMAGE_MAP[taskName] || fallback;
  return `./assets/${slug}.jpg`;
}