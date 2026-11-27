import { Link } from 'react-router-dom';
import { Bot, Brain, CloudSun, Coins, Droplets, FlaskConical, Grid3x3, Languages, Leaf, Sprout, TestTubes } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';

export default function Landing() {
  const { t, lang, setLang } = useI18n();
  const { user } = useAuth();
  const features = [
    { icon: <Grid3x3 />, en: ['256-zone farm map', 'Every farm is divided into 16×16 geo-referenced zones, each with its own independent measurements.'], ar: ['خريطة 256 منطقة', 'تُقسَّم كل مزرعة إلى 16×16 منطقة مرتبطة جغرافيًا، لكل منها قياساتها المستقلة.'] },
    { icon: <Bot />, en: ['ESP32 soil robot', 'Authenticated Wi-Fi ingestion of moisture, pH, EC and temperature with deduplication and history.'], ar: ['روبوت ESP32 للتربة', 'استقبال مصادق عبر Wi-Fi للرطوبة والحموضة والملوحة والحرارة مع منع التكرار وحفظ السجل.'] },
    { icon: <TestTubes />, en: ['AI plant diagnosis', 'Disease and visible nutrient-deficiency analysis from photos — clearly separated from soil tests.'], ar: ['تشخيص النبات بالذكاء الاصطناعي', 'تحليل الأمراض وأعراض نقص العناصر من الصور — مع فصل واضح عن تحاليل التربة.'] },
    { icon: <Sprout />, en: ['Explainable crop advice', 'Crop suitability from pH, salinity, moisture, temperature and water availability, with the reasoning shown.'], ar: ['توصيات محاصيل قابلة للتفسير', 'ملاءمة المحاصيل حسب الحموضة والملوحة والرطوبة والحرارة وتوفر المياه مع عرض الأسباب.'] },
    { icon: <CloudSun />, en: ['NASA POWER weather', 'Daily agro-climatology for your exact coordinates, stored with update times.'], ar: ['طقس NASA POWER', 'بيانات مناخية زراعية يومية لإحداثيات مزرعتك، محفوظة مع وقت التحديث.'] },
    { icon: <Droplets />, en: ['Irrigation planning', 'FAO-56 crop water need per zone and water-use tracking.'], ar: ['تخطيط الري', 'احتياج المحصول المائي لكل منطقة وفق FAO-56 وتتبع استهلاك المياه.'] },
    { icon: <FlaskConical />, en: ['BioPod research', 'Replicated experiments, water-retention comparisons and Welch t-tests.'], ar: ['أبحاث BioPod', 'تجارب بمكررات، ومقارنة الاحتفاظ بالمياه واختبار Welch t.'] },
    { icon: <Coins />, en: ['Farm finance', 'Expenses, harvests, sales and profit in EGP — actual and estimated kept separate.'], ar: ['الإدارة المالية', 'المصروفات والحصاد والمبيعات والربح بالجنيه — مع فصل الفعلي عن التقديري.'] },
    { icon: <Brain />, en: ['Decision support', 'Prioritized, explainable actions per zone that combine all available data.'], ar: ['دعم القرار', 'إجراءات مرتبة وقابلة للتفسير لكل منطقة تجمع كل البيانات المتاحة.'] },
  ];
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2 text-lg font-bold text-brand-900"><span className="rounded-lg bg-brand-700 p-1.5 text-white"><Leaf size={20} /></span>{t('Smart Farm', 'المزرعة الذكية')}</div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}><Languages size={16} />{lang === 'ar' ? 'English' : 'العربية'}</button>
          {user ? <Link to="/app" className="btn-primary">{t('Open dashboard', 'افتح لوحة التحكم')}</Link> : <>
            <Link to="/login" className="btn-secondary">{t('Log in', 'دخول')}</Link>
            <Link to="/signup" className="btn-primary">{t('Get started', 'ابدأ الآن')}</Link>
          </>}
        </div>
      </header>
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight text-brand-950 sm:text-5xl">{t('Precision agriculture for every farm', 'زراعة دقيقة لكل مزرعة')}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">{t('Measure your soil zone by zone, connect your ESP32 robot, and get transparent recommendations that save water, fertilizer and cost.', 'قِس تربتك منطقةً بمنطقة، واربط روبوت ESP32، واحصل على توصيات شفافة توفر المياه والأسمدة والتكاليف.')}</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to={user ? '/app' : '/signup'} className="btn-primary px-6 py-3 text-base">{t('Start for free', 'ابدأ مجانًا')}</Link>
            <a href="#features" className="btn-secondary px-6 py-3 text-base">{t('See features', 'استعرض المزايا')}</a>
          </div>
        </div>
      </section>
      <section id="features" className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => {
          const [title, body] = lang === 'ar' ? f.ar : f.en;
          return (
            <div key={f.en[0]} className="card p-5">
              <div className="mb-3 inline-flex rounded-lg bg-brand-100 p-2 text-brand-700">{f.icon}</div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{body}</p>
            </div>
          );
        })}
      </section>
      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">{t('Recommendations are decision support and do not replace local agronomist advice or laboratory analysis.', 'التوصيات للدعم في اتخاذ القرار ولا تغني عن المهندس الزراعي المحلي أو التحليل المعملي.')}</footer>
    </div>
  );
}
