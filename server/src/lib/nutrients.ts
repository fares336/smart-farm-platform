import { L, type LText } from './i18n.js';

export type NutrientKey = 'N' | 'P' | 'K' | 'Ca' | 'Mg' | 'S' | 'Fe' | 'Zn' | 'Mn' | 'B' | 'Cu';

export interface NutrientInfo {
  key: NutrientKey;
  name: LText;
  mobility: 'mobile' | 'immobile';
  symptoms: LText;
  causes: LText[];
  mostAffectedCrops: string[];
  fertilizers: { name: LText; note?: LText }[];
  application: LText;
  timing: LText;
  confirmTests: LText[];
  lookalikes: LText[];
  lowPhRisk: boolean;
  highPhRisk: boolean;
}

/** General agronomic reference (FAO Plant Nutrition for Food Security; IPNI 4R; extension literature). */
export const NUTRIENTS: Record<NutrientKey, NutrientInfo> = {
  N: {
    key: 'N', name: L('Nitrogen (N)', 'النيتروجين (N)'), mobility: 'mobile',
    symptoms: L('Uniform pale-green to yellow older (lower) leaves; stunted growth.', 'اصفرار منتظم للأوراق القديمة السفلية؛ تقزم النمو.'),
    causes: [L('Low soil organic matter', 'انخفاض المادة العضوية'), L('Leaching after heavy irrigation', 'غسيل النيتروجين بعد ري غزير'), L('Waterlogging', 'تشبع التربة بالمياه')],
    mostAffectedCrops: ['maize', 'wheat', 'rice', 'cotton', 'sugarcane'],
    fertilizers: [{ name: L('Urea (46% N)', 'يوريا (46% ن)') }, { name: L('Ammonium nitrate (33.5% N)', 'نترات الأمونيوم (33.5% ن)') }, { name: L('Ammonium sulfate (20.6% N, 24% S)', 'سلفات الأمونيوم (20.6% ن، 24% كبريت)'), note: L('Acidifying; useful in alkaline soils', 'حامضية التأثير؛ مفيدة في الأراضي القلوية') }],
    application: L('Split soil applications or fertigation; avoid single large doses.', 'إضافات أرضية مجزأة أو مع ماء الري؛ تجنب الدفعة الكبيرة الواحدة.'),
    timing: L('Before rapid vegetative growth and at key growth stages.', 'قبل مرحلة النمو الخضري السريع وفي المراحل الحرجة.'),
    confirmTests: [L('Leaf tissue N analysis', 'تحليل نيتروجين الأوراق'), L('Soil nitrate test', 'تحليل نترات التربة')],
    lookalikes: [L('Sulfur deficiency (but S affects young leaves first)', 'نقص الكبريت (لكنه يظهر على الأوراق الحديثة أولًا)'), L('Waterlogging or root disease', 'تشبع التربة أو أمراض الجذور')],
    lowPhRisk: false, highPhRisk: false,
  },
  P: {
    key: 'P', name: L('Phosphorus (P)', 'الفوسفور (P)'), mobility: 'mobile',
    symptoms: L('Dark green or purplish older leaves, slow growth, delayed maturity.', 'أوراق قديمة خضراء داكنة أو أرجوانية، بطء النمو، تأخر النضج.'),
    causes: [L('High pH / calcareous soil fixing P', 'ارتفاع الحموضة/الأراضي الجيرية تثبت الفوسفور'), L('Cold soils', 'برودة التربة'), L('Low soil P', 'انخفاض فوسفور التربة')],
    mostAffectedCrops: ['maize', 'wheat', 'tomato', 'potato', 'beans'],
    fertilizers: [{ name: L('Single superphosphate (15% P2O5)', 'سوبر فوسفات أحادي (15% فو2أ5)') }, { name: L('Monoammonium phosphate (MAP)', 'فوسفات أحادي الأمونيوم (MAP)') }, { name: L('Phosphoric acid via fertigation', 'حمض الفوسفوريك مع ماء الري'), note: L('For drip systems', 'لنظم الري بالتنقيط') }],
    application: L('Band near the root zone at or before planting.', 'إضافة في شريط قرب منطقة الجذور عند الزراعة أو قبلها.'),
    timing: L('Mainly pre-planting and early growth.', 'أساسًا قبل الزراعة وفي بداية النمو.'),
    confirmTests: [L('Soil available P (Olsen method for alkaline soils)', 'فوسفور التربة الميسر (طريقة أولسن للأراضي القلوية)'), L('Leaf P analysis', 'تحليل فوسفور الأوراق')],
    lookalikes: [L('Cold stress (purpling)', 'إجهاد البرودة (تلون أرجواني)'), L('Varietal anthocyanin colour', 'لون صبغي وراثي في بعض الأصناف')],
    lowPhRisk: true, highPhRisk: true,
  },
  K: {
    key: 'K', name: L('Potassium (K)', 'البوتاسيوم (K)'), mobility: 'mobile',
    symptoms: L('Yellowing then browning (scorch) of older leaf margins and tips.', 'اصفرار ثم احتراق حواف وأطراف الأوراق القديمة.'),
    causes: [L('Sandy, low-K soils', 'أراضٍ رملية فقيرة في البوتاسيوم'), L('High Ca/Mg or Na competing for uptake', 'ارتفاع الكالسيوم/المغنيسيوم أو الصوديوم المنافس على الامتصاص'), L('Drought limiting uptake', 'الجفاف يحد من الامتصاص')],
    mostAffectedCrops: ['potato', 'tomato', 'cotton', 'sugarcane', 'banana'],
    fertilizers: [{ name: L('Potassium sulfate (SOP, 50% K2O)', 'سلفات البوتاسيوم (50% بو2أ)'), note: L('Preferred in saline soils (no chloride)', 'مفضلة في الأراضي الملحية (خالية من الكلوريد)') }, { name: L('Potassium nitrate', 'نترات البوتاسيوم') }, { name: L('Potassium chloride (MOP)', 'كلوريد البوتاسيوم'), note: L('Avoid where salinity/chloride is high', 'تجنبه عند ارتفاع الملوحة/الكلوريد') }],
    application: L('Soil band or fertigation; foliar sprays as short-term support.', 'إضافة أرضية أو مع ماء الري؛ الرش الورقي كدعم مؤقت.'),
    timing: L('Before flowering/fruit or tuber bulking.', 'قبل التزهير أو امتلاء الثمار/الدرنات.'),
    confirmTests: [L('Soil exchangeable K', 'البوتاسيوم المتبادل بالتربة'), L('Leaf K analysis', 'تحليل بوتاسيوم الأوراق'), L('Soil EC / sodium (SAR) to exclude salinity', 'التوصيل الكهربي/الصوديوم لاستبعاد الملوحة')],
    lookalikes: [L('Salt injury causes similar leaf-margin scorch', 'ضرر الأملاح يسبب احتراقًا مشابهًا لحواف الأوراق'), L('Drought stress', 'إجهاد الجفاف'), L('Fungal leaf spots', 'تبقعات فطرية')],
    lowPhRisk: false, highPhRisk: false,
  },
  Ca: {
    key: 'Ca', name: L('Calcium (Ca)', 'الكالسيوم (Ca)'), mobility: 'immobile',
    symptoms: L('Damage to growing points and young leaves; blossom-end rot in tomato/pepper.', 'تلف القمم النامية والأوراق الحديثة؛ عفن الطرف الزهري في الطماطم والفلفل.'),
    causes: [L('Irregular irrigation (most common)', 'عدم انتظام الري (الأكثر شيوعًا)'), L('Acidic soils', 'الأراضي الحامضية'), L('High salinity or excess K/NH4', 'ارتفاع الملوحة أو زيادة البوتاسيوم/الأمونيوم')],
    mostAffectedCrops: ['tomato', 'pepper', 'potato', 'apple'],
    fertilizers: [{ name: L('Calcium nitrate', 'نترات الكالسيوم') }, { name: L('Gypsum (calcium sulfate)', 'الجبس الزراعي'), note: L('Also used to treat sodic soils', 'يستخدم أيضًا لعلاج الأراضي الصودية') }],
    application: L('Fertigation and consistent irrigation; foliar Ca on fruit as support.', 'مع ماء الري مع انتظام الري؛ رش كالسيوم على الثمار كدعم.'),
    timing: L('From flowering through fruit set.', 'من التزهير حتى العقد.'),
    confirmTests: [L('Soil Ca and pH', 'كالسيوم التربة والحموضة'), L('Review irrigation regularity', 'مراجعة انتظام الري')],
    lookalikes: [L('Water stress or root damage', 'إجهاد مائي أو تلف الجذور')],
    lowPhRisk: true, highPhRisk: false,
  },
  Mg: {
    key: 'Mg', name: L('Magnesium (Mg)', 'المغنيسيوم (Mg)'), mobility: 'mobile',
    symptoms: L('Interveinal yellowing on older leaves; veins stay green.', 'اصفرار بين العروق في الأوراق القديمة مع بقاء العروق خضراء.'),
    causes: [L('Sandy or acidic soils', 'أراضٍ رملية أو حامضية'), L('Excess K or Ca', 'زيادة البوتاسيوم أو الكالسيوم')],
    mostAffectedCrops: ['tomato', 'potato', 'citrus', 'grapes', 'maize'],
    fertilizers: [{ name: L('Magnesium sulfate (Epsom salt)', 'سلفات المغنيسيوم (ملح إبسوم)') }, { name: L('Dolomitic lime (acid soils only)', 'جير دولوميتي (للأراضي الحامضية فقط)') }],
    application: L('Soil or fertigation; foliar MgSO4 for quick correction.', 'إضافة أرضية أو مع ماء الري؛ رش سلفات المغنيسيوم للتصحيح السريع.'),
    timing: L('When symptoms appear and during fruit development.', 'عند ظهور الأعراض وأثناء نمو الثمار.'),
    confirmTests: [L('Soil exchangeable Mg and K:Mg ratio', 'المغنيسيوم المتبادل ونسبة البوتاسيوم/المغنيسيوم'), L('Leaf analysis', 'تحليل الأوراق')],
    lookalikes: [L('Viral mosaics', 'تبرقش فيروسي'), L('Natural senescence', 'شيخوخة طبيعية للأوراق')],
    lowPhRisk: true, highPhRisk: false,
  },
  S: {
    key: 'S', name: L('Sulfur (S)', 'الكبريت (S)'), mobility: 'immobile',
    symptoms: L('Uniform yellowing of young (upper) leaves.', 'اصفرار منتظم للأوراق الحديثة العلوية.'),
    causes: [L('Low organic matter', 'انخفاض المادة العضوية'), L('Use of S-free fertilizers', 'استخدام أسمدة خالية من الكبريت')],
    mostAffectedCrops: ['onion', 'canola', 'beans', 'wheat'],
    fertilizers: [{ name: L('Ammonium sulfate', 'سلفات الأمونيوم') }, { name: L('Gypsum', 'الجبس الزراعي') }, { name: L('Elemental sulfur (slow, acidifying)', 'كبريت زراعي (بطيء، حامضي التأثير)') }],
    application: L('Soil application before planting or early growth.', 'إضافة أرضية قبل الزراعة أو في بداية النمو.'),
    timing: L('Pre-planting / early season.', 'قبل الزراعة/بداية الموسم.'),
    confirmTests: [L('Soil sulfate-S', 'كبريتات التربة'), L('Leaf S and N:S ratio', 'كبريت الأوراق ونسبة النيتروجين/الكبريت')],
    lookalikes: [L('Nitrogen deficiency (older leaves first)', 'نقص النيتروجين (الأوراق القديمة أولًا)')],
    lowPhRisk: false, highPhRisk: false,
  },
  Fe: {
    key: 'Fe', name: L('Iron (Fe)', 'الحديد (Fe)'), mobility: 'immobile',
    symptoms: L('Interveinal chlorosis of youngest leaves; severe cases nearly white.', 'اصفرار بين العروق في أحدث الأوراق؛ وقد تبيض في الحالات الشديدة.'),
    causes: [L('High pH / calcareous soils (very common in Egypt)', 'ارتفاع الحموضة والأراضي الجيرية (شائع جدًا في مصر)'), L('Waterlogging, high bicarbonate water', 'تشبع التربة، مياه ري عالية البيكربونات')],
    mostAffectedCrops: ['citrus', 'beans', 'grapes', 'peach', 'sorghum'],
    fertilizers: [{ name: L('Fe-EDDHA chelate', 'حديد مخلبي Fe-EDDHA'), note: L('Stable at high pH', 'ثابت في الأراضي القلوية') }, { name: L('Fe-EDTA / Fe-DTPA foliar', 'حديد مخلبي EDTA/DTPA رشًا') }],
    application: L('Chelated Fe to soil/fertigation; foliar for quick response.', 'حديد مخلبي للتربة أو مع ماء الري؛ والرش للاستجابة السريعة.'),
    timing: L('Early in the season at first symptoms.', 'مبكرًا في الموسم عند أول ظهور للأعراض.'),
    confirmTests: [L('Soil pH and calcium carbonate', 'حموضة التربة وكربونات الكالسيوم'), L('DTPA-extractable Fe', 'الحديد المستخلص بـ DTPA')],
    lookalikes: [L('Manganese or zinc deficiency', 'نقص المنجنيز أو الزنك'), L('Herbicide injury', 'ضرر مبيدات الحشائش')],
    lowPhRisk: false, highPhRisk: true,
  },
  Zn: {
    key: 'Zn', name: L('Zinc (Zn)', 'الزنك (Zn)'), mobility: 'immobile',
    symptoms: L('Small, narrow young leaves (little leaf), short internodes, interveinal chlorosis/bronzing.', 'أوراق حديثة صغيرة وضيقة، قصر السلاميات، اصفرار أو تبرنز بين العروق.'),
    causes: [L('High pH and high P', 'ارتفاع الحموضة والفوسفور'), L('Low organic matter', 'انخفاض المادة العضوية')],
    mostAffectedCrops: ['maize', 'rice', 'citrus', 'beans', 'wheat'],
    fertilizers: [{ name: L('Zinc sulfate', 'سلفات الزنك') }, { name: L('Zn-EDTA chelate (foliar)', 'زنك مخلبي (رشًا)') }],
    application: L('Soil before planting or foliar spray at early growth.', 'إضافة أرضية قبل الزراعة أو رش ورقي في بداية النمو.'),
    timing: L('Early vegetative stage.', 'مرحلة النمو الخضري المبكر.'),
    confirmTests: [L('DTPA-extractable Zn', 'الزنك المستخلص بـ DTPA'), L('Leaf Zn analysis', 'تحليل زنك الأوراق')],
    lookalikes: [L('Iron or manganese deficiency', 'نقص الحديد أو المنجنيز'), L('Viral diseases', 'أمراض فيروسية')],
    lowPhRisk: false, highPhRisk: true,
  },
  Mn: {
    key: 'Mn', name: L('Manganese (Mn)', 'المنجنيز (Mn)'), mobility: 'immobile',
    symptoms: L('Interveinal chlorosis on young leaves with small necrotic spots.', 'اصفرار بين العروق في الأوراق الحديثة مع بقع ميتة صغيرة.'),
    causes: [L('High pH, high organic matter', 'ارتفاع الحموضة والمادة العضوية')],
    mostAffectedCrops: ['wheat', 'beans', 'citrus', 'potato'],
    fertilizers: [{ name: L('Manganese sulfate (foliar or band)', 'سلفات المنجنيز (رشًا أو شريطيًا)') }],
    application: L('Foliar spray is usually most effective in alkaline soils.', 'الرش الورقي هو الأكثر فعالية عادة في الأراضي القلوية.'),
    timing: L('At first symptoms.', 'عند ظهور الأعراض.'),
    confirmTests: [L('DTPA-extractable Mn', 'المنجنيز المستخلص بـ DTPA'), L('Leaf analysis', 'تحليل الأوراق')],
    lookalikes: [L('Iron deficiency', 'نقص الحديد')],
    lowPhRisk: false, highPhRisk: true,
  },
  B: {
    key: 'B', name: L('Boron (B)', 'البورون (B)'), mobility: 'immobile',
    symptoms: L('Death of growing tips, brittle/deformed young leaves, poor fruit/seed set.', 'موت القمم النامية، أوراق حديثة هشة أو مشوهة، ضعف العقد.'),
    causes: [L('Sandy soils, heavy leaching', 'أراضٍ رملية، غسيل شديد'), L('Drought', 'جفاف')],
    mostAffectedCrops: ['sugar beet', 'cotton', 'tomato', 'onion'],
    fertilizers: [{ name: L('Borax / Solubor', 'بوراكس / سولوبور'), note: L('Narrow safe range — toxicity risk', 'الحد الآمن ضيق — خطر التسمم') }],
    application: L('Low-rate foliar or soil application only after testing.', 'رش أو إضافة أرضية بمعدلات منخفضة فقط بعد التحليل.'),
    timing: L('Before flowering.', 'قبل التزهير.'),
    confirmTests: [L('Hot-water soluble soil B', 'البورون الذائب في الماء الساخن'), L('Irrigation water B (toxicity check)', 'بورون مياه الري (للتأكد من عدم السمية)')],
    lookalikes: [L('Calcium deficiency', 'نقص الكالسيوم')],
    lowPhRisk: false, highPhRisk: true,
  },
  Cu: {
    key: 'Cu', name: L('Copper (Cu)', 'النحاس (Cu)'), mobility: 'immobile',
    symptoms: L('Young leaves wilt, twist or show pale tips; poor grain fill in cereals.', 'ذبول أو التواء الأوراق الحديثة وشحوب أطرافها؛ ضعف امتلاء الحبوب.'),
    causes: [L('Peat/organic or very sandy soils', 'أراضٍ عضوية أو رملية جدًا')],
    mostAffectedCrops: ['wheat', 'barley', 'citrus'],
    fertilizers: [{ name: L('Copper sulfate or Cu chelate (low rate)', 'سلفات النحاس أو نحاس مخلبي (بمعدل منخفض)') }],
    application: L('Foliar at low rates after confirmation.', 'رش بمعدلات منخفضة بعد التأكيد.'),
    timing: L('Early growth.', 'بداية النمو.'),
    confirmTests: [L('DTPA-extractable Cu', 'النحاس المستخلص بـ DTPA')],
    lookalikes: [L('Drought wilting', 'ذبول الجفاف')],
    lowPhRisk: false, highPhRisk: true,
  },
};

export const NUTRIENT_KEYS = Object.keys(NUTRIENTS) as NutrientKey[];
