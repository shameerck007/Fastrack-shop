export type DayPart = "morning" | "afternoon" | "evening" | "night";

/** The hour (0-23) and calendar date in the market's own time zone, so "Good morning" matches where the supplier is. */
export function localClock(tz: string, now = new Date()): { hour: number; weekday: string; dateLine: string; dayOfYear: number } {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(now)) % 24;
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long" }).format(now);
  const dateLine = new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "long", year: "numeric" }).format(now);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now).split("-").map(Number);
  const dayOfYear = Math.floor((Date.UTC(ymd[0], ymd[1] - 1, ymd[2]) - Date.UTC(ymd[0], 0, 0)) / 86400_000);
  return { hour, weekday, dateLine, dayOfYear };
}

export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

const HELLO: Record<"en" | "ar", Record<DayPart, string>> = {
  en: { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", night: "Working late" },
  ar: { morning: "صباح الخير", afternoon: "طاب يومك", evening: "مساء الخير", night: "تعمل حتى وقت متأخر" },
};

export const PART_ICON: Record<DayPart, string> = { morning: "🌅", afternoon: "☀️", evening: "🌇", night: "🌙" };

export const hello = (part: DayPart, locale: string) => HELLO[locale === "ar" ? "ar" : "en"][part];

const QUOTES: Record<"en" | "ar", Record<DayPart, string[]>> = {
  en: {
    morning: [
      "A fresh day, a fresh chance to delight a customer.",
      "Start small, stay steady: every order you pack well builds your name.",
      "Great shops are built one careful morning at a time.",
      "Check your stock, smile, and let the day come to you.",
      "Today's first order is tomorrow's regular customer.",
      "Good products, honest prices, on-time packing: that is the whole recipe.",
      "Make today a day customers remember for the right reasons.",
      "Energy in the morning sets the pace for the whole day.",
    ],
    afternoon: [
      "Halfway through the day: a quick look at stock keeps the evening calm.",
      "Every parcel that leaves on time is a promise kept.",
      "Busy is good. Careful is better. Keep both.",
      "Small improvements, made every day, become a big advantage.",
      "A quick restock now saves a lost sale later.",
      "Customers remember how reliable you were, not how fast you talked.",
      "Keep going: the afternoon rush rewards the prepared.",
      "Quality packing is the best advert you will ever have.",
    ],
    evening: [
      "Well done today. Close the day with a quick look at tomorrow's stock.",
      "Rest is part of the work: a calm evening makes a sharp morning.",
      "Every order delivered today is a reason to be proud.",
      "Look back at what went well, and carry that into tomorrow.",
      "Steady shops win in the long run. Thank you for showing up today.",
      "The day's work is done when tomorrow is ready.",
      "Count the good orders, learn from the hard ones, and rest well.",
      "A tidy stock room tonight means a smooth start tomorrow.",
    ],
    night: [
      "Late hours today build a stronger shop tomorrow. Do not forget to rest.",
      "Quiet hours are good for planning: prices, stock, and new products.",
      "Sleep is part of the business plan. Tomorrow needs you fresh.",
      "A little preparation tonight, a lot less stress tomorrow.",
      "Even the busiest shop needs a pause. Rest well.",
      "Plan tonight, pack well tomorrow.",
      "Orders can wait until morning; your health cannot.",
      "A calm mind sells better than a tired one.",
    ],
  },
  ar: {
    morning: [
      "يوم جديد وفرصة جديدة لإسعاد عميل.",
      "ابدأ بخطوة صغيرة وثابتة: كل طلب تجهّزه بإتقان يبني اسمك.",
      "المتاجر الناجحة تُبنى صباحًا بعد صباح بعناية.",
      "راجع مخزونك وابتسم ودع اليوم يأتيك.",
      "أول طلب اليوم قد يكون عميلك الدائم غدًا.",
      "منتجات جيدة وأسعار صادقة وتجهيز في الوقت: هذه هي الوصفة كلها.",
      "اجعل يومك يومًا يتذكره عملاؤك بالخير.",
      "نشاط الصباح يحدد إيقاع اليوم كله.",
    ],
    afternoon: [
      "منتصف اليوم: نظرة سريعة على المخزون تجعل المساء هادئًا.",
      "كل طرد يخرج في وقته هو وعد تم الوفاء به.",
      "الانشغال جيد، والدقة أفضل، فاجمع بينهما.",
      "تحسينات صغيرة كل يوم تتحول إلى ميزة كبيرة.",
      "تعبئة سريعة للمخزون الآن تنقذ بيعة غدًا.",
      "العملاء يتذكرون مدى التزامك لا كثرة كلامك.",
      "واصل، فذروة العصر تكافئ المستعد.",
      "التغليف الجيد أفضل إعلان لك.",
    ],
    evening: [
      "أحسنت اليوم. اختم يومك بنظرة على مخزون الغد.",
      "الراحة جزء من العمل: مساء هادئ يعني صباحًا نشيطًا.",
      "كل طلب وصل اليوم سبب للفخر.",
      "انظر لما نجح اليوم وخذه معك إلى الغد.",
      "المتاجر الثابتة تفوز على المدى الطويل. شكرًا لحضورك اليوم.",
      "عمل اليوم ينتهي حين يصبح الغد جاهزًا.",
      "عدّ الطلبات الجيدة وتعلّم من الصعبة ثم ارتح.",
      "مخزن مرتب الليلة يعني بداية سلسة غدًا.",
    ],
    night: [
      "ساعات الليل اليوم تبني متجرًا أقوى غدًا، لا تنسَ الراحة.",
      "الهدوء وقت جيد للتخطيط: الأسعار والمخزون والمنتجات الجديدة.",
      "النوم جزء من خطة العمل، فغدًا يحتاجك نشيطًا.",
      "قليل من التحضير الليلة وضغط أقل غدًا.",
      "حتى أنشط متجر يحتاج إلى استراحة. نم جيدًا.",
      "خطّط الليلة وجهّز جيدًا غدًا.",
      "الطلبات تنتظر حتى الصباح أما صحتك فلا.",
      "العقل الهادئ يبيع أفضل من المتعب.",
    ],
  },
};

/** One quote per part of the day, changing each calendar day. */
export function quoteFor(part: DayPart, dayOfYear: number, locale: string): string {
  const list = QUOTES[locale === "ar" ? "ar" : "en"][part];
  return list[dayOfYear % list.length];
}
