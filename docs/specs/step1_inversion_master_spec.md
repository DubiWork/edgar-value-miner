# מפרט מאסטר ותוכנית ביצוע: Step 1 Inversion, Red-Flag Engine & Trust Gatekeeper

> [!IMPORTANT]
> **מטרת העל ("אשמה עד שתוכח חפותה"):** להפוך את Step 1 ממסך שמועד ל"אשליית הירוק" למסך סינון מהיר (`60-Second Inversion`) שמציף מיד דגלים אדומים, מלכודות חשבונאיות וסיכוני סקטור — כדי שמשקיע ערך יוכל לפסול עסקים חלשים ב-60 שניות על בסיס **4/4 מקורות מחקר מאוחדים** (*המשקיע הנבון*, *מכתבי וורן באפט לבעלי המניות*, ומתודולוגיית *Quality Compounders / Antifragile*).
>
> **סטטוס מסמך:** זהו **מקור האמת היחיד (Canonical Single Source of Truth)** של סשני העבודה על Step 1, לאחר נעילת כל ההכרעות (`A1`–`A4` והנחיית הבהירות הלימודית בעברית).

---

## 0. עקרונות מוצר ו-UX נעולים (Mandatory Product Rules)

1. **חובת בהירות לימודית בעברית פשוטה בתוך הממשק (`Educational UX Mandate`):**
   - **כל** מושג פיננסי, מדד, תג סטטוס, דגל אדום/צהוב ותגית הקשר כחולה (`ℹ️`) חייבים לכלול הסבר לימודי ברור בעברית פשוטה בתוך הממשק עצמו (`ResponsiveTooltip` / פירוט נפתח), כך שמשתמש חדש **לעולם לא יצטרך לצאת החוצה** כדי להבין מה הנתון אומר ולמה הוחלט כך.
   - ציטוטים מ*המשקיע הנבון* ומ*מכתבי וורן באפט לבעלי המניות* ישולבו כתובנה קצרה בעברית (`<= 12` מילים) לצד הציטוט המקורי באנגלית (`dir="ltr"`) בתוך המגירה/Tooltip.
   - **כלל ייחוס ופרטיות:** אין להזכיר שמות מנטורים או אנליסטים פרטיים בממשק, בקוד, בבדיקות או בתיעוד הציבורי; ייחוס ציבורי ניתן רק ל*המשקיע הנבון (בנג׳מין גראהם)*, *מכתבי וורן באפט לבעלי המניות* ומתודולוגיית *Quality Compounders / Antifragile*.
2. **מיקום התראות ותחושת אווריריות — אופציה C ההיברידית (`A3` Locked):**
   - כרטיס ה-Tear Sheet ([Step1Triage.jsx](../../src/components/Stepper/Step1Triage.jsx)) כבר צפוף במובייל (`~710px` ב-`375px`), ולכן באנר אזהרות מורחב למעלה יוצר עומס חזותי ודוחף את הגרפים מתחת לקיפול; מאידך, העברה מוחלטת לתחתית מעלימה אותות פסילה מיידיים מעבר ל-3 גלילות במובייל.
   - **הפתרון הנעול — אופציה C (היברידית):**
     1. **למעלה (שורה דקיקה בת `38–40px`, `0px CLS`):** פס סטטוס קומפקטי בשורה אחת בראש כרטיס ה-Tear Sheet (למשל `🚩 2 דגלים אדומים · ⚠️ 2 אזהרות · לפירוט ↓`, או בחברות נקיות `✓ 0 דגלים אדומים · סינון נקי · לסיכום ↓`, או `ℹ️ 1 הקשר מאזני · לפירוט ↓`). לחיצה גוללת חלק אל כרטיס הפירוט למטה עם הבהוב עדין (`ring-2`).
     2. **באמצע:** כרטיסי המדדים (`max-w-6xl` בדסקטופ עם `xl:grid-cols-5` מ-PR 3, כשהפרוזה ב-Tear Sheet נשארת `max-w-4xl` לקריאות מיטבית).
     3. **למטה (ממש מעל כפתור ה-Gatekeeper המלוקלז):** כרטיס **`Inversion Risk & Guardrail Breakdown` (`#step1-risk-breakdown`)** המרכז: Tier 1 דגלים אדומים פוסלים, Tier 2 אזהרות צהובות (עד `3–4` חמורות + `+N` להרחבה, עם מיזוג אזהרות חופפות), ו-Tier 3 סעיף נפרד רגוע להקשר חשבונאי.
3. **ייעוד זמן-אפס (`0ms CLS`) ופיצול פייננסים (`A2` Locked):**
   - סיווג דטרמיניסטי מיידי (`~200ms`) מתוך תגיות XBRL ומטא-דאטה (`inferArchetypeFromXbrlAndMeta`), המבטיח אפס קפיצת פריסה (`0px CLS`) בזמן ש-Vertex AI טוען את הסריקה העסקית (`3–5s`).
   - פיצול תתי-סקטור ב-`FINANCIAL_SPREAD` בין חברות **ליסינג/מימון לא-בנקאיות ו-REITs** (דוגמת `AER`) לבין **בנקים ופינטקים מקבלי פיקדונות** (דוגמת `KLAR`).
4. **שער קידום ל-Production (`PR #317` Locked):**
   - מיזוג `PR #317` (`develop -> main`) מוקפא עד לסיום ואימות משותף על Staging של **שלישיית הליבה `PR 1 (v1.2.6)` + `PR 2 (v1.3.0)` + `PR 3 (v1.4.0)`** מול `AER`, `SAP`, `MSFT`, `HD`, `ADBE` ו-`KLAR`.

---

## 1. אבחון הכשל ב-`AER` והבאגים החשבונאיים שאותרו בקוד

### א. שורשי תקלת "אשליית הירוק" על `AER`
1. **דריסת תנודתיות בשוליים ב-[triageCalculator.js](../../src/utils/triageCalculator.js):** הבדיקה `latest.value >= 25` (`48.0%`) הורצה **לפני** `isCyclical`, ולכן החזירה `"גבוהים ויציבים"` בירוק למרות שנת הפסד של `-14.3%` ו-`5` שנות ירידה בהכנסות.
2. **באג היפוך המינוס בעברית (RTL BiDi) ב-[Step1Triage.jsx](../../src/components/Stepper/Step1Triage.jsx):** תבנית `LTR_BIDI_TOKEN_REGEX` לכדה את המקף של מילת היחס העברית (`ל-48.0%`) לתוך `<bdi dir="ltr">-48.0%</bdi>`, והפכה מספר חיובי למינוס חזותי (`ל-48.0%-`). התיקון: טוקנייזר `exec()` לינארי בזמן `O(n)` **ללא lookbehind** (לתמיכה מלאה ב-Safari ומניעת ReDoS) המפריד `[מלבכשהו]-` כ-RTL טהור.
3. **נפילה שקטה ל-`DEFAULT_MSFT_TRIAGE` ב-[triageCalculator.js](../../src/utils/triageCalculator.js):** בהיעדר נתון XBRL, המחשבון החזיר נתונים מפוברקים של מיקרוסופט (`$245B`, `44.6%`, `-7.4%` בייבאק). חובה לבטל לחלוטין ולהחזיר מצב **`unavailable`** (`אין נתוני SEC`).

### ב. 5 באגים נסתרים בנרמול XBRL ב-[gaapNormalizer.js](../../src/utils/gaapNormalizer.js) + Cache
1. **`totalLiabilities` שבור:** fallback שגוי ל-`LiabilitiesAndStockholdersEquity` (= סך הנכסים!) וב-IFRS ל-`NoncurrentLiabilities` בלבד (מפיל התחייבויות שוטפות). יש להסיר ולגזור `totalAssets - stockholdersEquity` בהיעדר תגית ראשית.
2. **`totalDebt` חלקי ששובר את `resolveDebt`:** fallback שגוי ל-`LongTermDebtAndCapitalLeaseObligationsCurrent` (חוב שוטף בלבד), שגרם ל-[calculateDebtToEquity.js](../../src/utils/calculateDebtToEquity.js) להחזיר חוב חסר. יש להסיר ולגזור `(shortTermDebt ?? 0) + (longTermDebt ?? 0)`.
3. **כפילות בספירת `Goodwill`:** `intangibleAssets` נפל ל-`IntangibleAssetsNetIncludingGoodwill` וספר מוניטין פעמיים.
4. **CapEx לא-מזומני:** `capitalExpenditures` כלל את `CapitalExpendituresIncurredButNotYetPaid` (מעוות את חישוב ה-`FCF`).
5. **תגיות חסרות + IFRS Bank Revenue:** חסרו `InterestExpenseOperating` (קריטי ב-`AER`), `InterestPaidNet` (כ-fallback מסומן `isCashFallback: true`), `stockBasedCompensation` (GAAP + IFRS), `deferredRevenueCurrent` (GAAP + IFRS), `ProfitLossBeforeTax` ב-IFRS, והכללת `'InterestRevenueExpense'` ב-`BANK_REVENUE_TAGS`.
6. **גרסאות Cache (L1 IndexedDB vs L2 Firestore) וסינון טווחי זמן / `too_large` (`#356`, `#362`, `#365`):** L1 ([edgarCache.js](../../src/services/edgarCache.js)) שומר תוצאות מנורמלות 90 יום בלי לבדוק `normalizationVersion`, ודיווחי `10-K` עם ביאורים בני 90 יום ללא `frame` (גם עם `fp: 'FY'`) דלפו לסדרות השנתיות וניפחו שוליים (`MSFT` `109.2%`). יש לסנן עובדות משך (`300–420` יום שנתי, `60–120` יום רבעוני, עם העדפת `frame` ודה-דופליקציה רבעונית), להעלות ל-`NORMALIZATION_VERSION = 3` ול-`DB_VERSION = 5`, לאכוף בדיקת גרסה ב-`isValidCacheEntry()`, ולטפל ב-`request.onblocked` (Firestore L2 שומר JSON גולמי ונשאר בגרסה `1`, ובקבצים מעל `900_000` בתים `cacheWriter.ts` מחזיר `{ updated: false, skippedReason: 'too_large' }` ללא שגיאת `429`).

---

## 2. טבלת מאסטר מאוחדת: ספים כמותיים, Guardrails, קונצנזוס וציטוטים

> [!NOTE]
> הציטוטים והכללים בטבלה זו ישולבו ישירות ב-Tooltips, בשורות כרטיס הפירוט ובהסברי המדדים — בעברית פשוטה וברורה עם ייחוס ל*המשקיע הנבון*, *מכתבי וורן באפט* ול*מתודולוגיית Quality Compounders / Antifragile*.

| מדד / בדיקה | ירוק (Pass) | צהוב (Warn) | אדום פוסל (Fail / Dealbreaker) | קונצנזוס & Guardrails (`A1` Locked) | ציטוט מובנה ל-Tooltip / כרטיס הפירוט |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **רווח גולמי (`Gross Margin`)** | `>= 30%–50%+` (`70%–80%+` תוכנה) | `0%–30%` (מותנה בסקטור קמעונאי יציב) | **`<= 0%` או `Revenue == 0`** ("תמרור עצור") | **4/4 מקורות** | **המשקיע הנבון:** דוגמאות קמעונאות שהפסידו סנטים על כל דולר מכירות בדרך לקריסה; **מתודולוגיית איכות:** רווח גולמי `<= 0%` פוסל אוטומטית כבר בשלב הייצור. |
| **צמיחה ועקביות בהכנסות (`5Y–10Y Revenue`)** | `CAGR >= 8%–10%` (`>= 15%` מצטיין) וללא מחזוריות חריפה | `CAGR < 5%` ("צמיחה איטית"), `>= 3` שנות ירידה ("צמיחה מחזורית"), או האטה חדה (`>= 10` נק׳ אחוז מתחת ל-`CAGR`) | **`>= 3` שנים רצופות של ירידה** (מודל מתכווץ) או ירידה נוכחית לצד מגמה שלילית | **4/4 מקורות** *(תווית מפורשת: `שנה אחרונה / YoY` מול `CAGR`)* | **מכתבי וורן באפט:** *"Growth benefits investors only when each dollar used to finance the growth creates over a dollar of long-term market value."* **המשקיע הנבון:** צמיחה בת-קיימא נמדדת בעקביות רב-שנתית ולא בקפיצה חד-פעמית. |
| **שולי רווח תפעולי ותנודתיות (`Operating Margin`)** | `>= 10%` (`>= 25%` גבוהים ויציבים, או `2%–6%` יציב לחלוטין בקמעונאות עלות-נמוכה) | `>= 10%` אך **מחזורי או תנודתי (`max - min > 20` נק׳ אחוז)**, או שחיקה חדה (`>= 10` נק׳ אחוז) | **שלילי בשנה אחרונה (`< 0%`), `< 10%` (שוליים נמוכים), או שנת הפסד ב-5–15 שנים (`min < 0%`)** | **4/4 מקורות** *(בדיקת Weakest-Link קודמת ל-`>= 25%`!)* | **המשקיע הנבון:** פוסל חברות עם שנת הפסד ב-5–10 שנים. **מכתבי וורן באפט:** מעבר משוליים יציבים לדפוס קופצני (*"erratic bob-around pattern"*) מסגיר שחיקת חפיר. |
| **תזרים מזומנים ואיכות רווחים (`3Y Cumulative OCF`, `FCF`)** | `ΣOCF / ΣNI >= 0.85x–1.0x` (3 ש׳), `FCF > 0`, `CapEx / OCF <= 50%` | `ΣOCF / ΣNI` בין `0.80x–1.0x` (3 ש׳), או `CapEx / OCF` בין `50%–70%` | **`ΣOCF / ΣNI < 0.80x` (כשהרווח חיובי)**, **`OCF < 0` עקבי עם `Financing CF > 0`** ("תלות בגיוסי הון"), או `FCF` שלילי רב-שנתי | **4/4 מקורות** *(שימוש במצטבר 3Y מונע רעשי מלאי חד-פעמיים)* | **המשקיע הנבון:** *"If cash from operating activities is consistently negative, while cash from financing activities is consistently positive, the company has a habit of craving more cash than its own businesses can produce."* **באפט:** *Owner Earnings*. |
| **נזילות, חוב וכיסוי ריבית (`Current Ratio`, `Debt`, `EBIT / Interest`)** | `Current Ratio >= 1.5x` (`2.0x` תעשייה), `Cash >= Debt`, `EBIT / Int >= 5.0x` | `Current Ratio` בין `1.0x–1.49x` ("גבולי"), `L/E` בין `1.6x–2.9x`, או `EBIT / Int` בין `1.5x–4.0x` | **`Current Ratio < 1.0x`**, **`Equity <= 0`**, `L/E >= 3.0x`, או **`EBIT / Interest < 1.5x`** | **`A1` Guardrails:**<br>1. **SaaS Deferred Revenue (`ADBE`/`CRM`):** סינון על **יחס שוטף מתואם** (`CA / (CL - DefRev)`) כשתזרים ונזילות תקינים + תגית `ℹ️ תשלומי מנויים מראש — לא חוב`.<br>2. **Buyback Cannibals (`HD`/`MCD`):** החרגת `Equity <= 0` כשתזרים חיובי, `EBIT/Int >= 4x`, `Net Debt/FCF <= 3x` ו`Treasury Stock` + `Retained Earnings > 0` מתועדים + תגית `ℹ️ הון שלילי מרכישה עצמית — תקין`. | **מכתבי וורן באפט:** *"Whenever someone creates a capital structure that does not allow all interest... to be comfortably met out of current cash flow net of ample capital expenditures – zip up your wallet."* **המשקיע הנבון:** מרווח ביטחון `2:1` בנכסים שוטפים. |
| **דילול מניות ותגמול מבוסס מניות (`Dilution` & `3Y SBC`)** | שינוי שנתי במניות `<= 0.2%` (בייבאק / יציב) ו-`SBC/Rev < 15%` | דילול מתון `+0.2%` עד `+3.0%` בשנה, או `SBC/Rev >= 15%` | **דילול `> 3.0%–5.0%` בשנה**, או **`3Y FCF_ex_SBC <= 0` לצד `SBC/Rev >= 20%`** | **4/4 מקורות** *(מבחן 3Y `FCF_ex_SBC` מונע פסילת שווא בשנת השקעה חריגה)* | **מכתבי וורן באפט:** *"If options aren't a form of compensation, what are they?"* ועל מדפיסי מניות: *"Wall Street's version of a chain-letter scheme."* |
| **מוניטין, רכישות ותשואה (`Goodwill`, `ROIC` / `ROE`)** | `ROIC & ROE >= 12%–15%`, `Goodwill/Assets < 40%` | `Goodwill / Assets >= 40%`, או `5Y ROE < 10%` | **`Goodwill / Assets >= 50%` רק כשמלווה ב-`ROIC < 10%`, `Net Debt/FCF > 4.0x` או דילול `> 2.5%`/שנה** | **4/4 מקורות** *(מניעת פסילה שגויה ל-Serial Compounders איכותיים; ללא פסילה עצמאית של `Goodwill+Intangibles > Equity`)* | **מכתבי וורן באפט:** *"When an overexcited management purchases a business at a silly price, the silliness ends up in the Goodwill account... it might better be labeled 'No-Will'."* |
| **דיבידנד ובייבאק ממומני חוב (`3Y Cumulative`)** | חלוקה מצטברת בתוך `3Y FCF` החיובי | יחס חלוקה קרוב ל-`100%` מה-`3Y FCF` | **`3Y (Dividends + Buybacks) > 3Y FCF` רק כשה-`Net Debt` עלה או `Cash < ShortTermDebt`** | **4/4 מקורות** | **מכתבי וורן באפט:** *"Other companies sell newly issued shares to Peter in order to pay dividends to Paul."* |

---

## 3. עיצוב מנגנוני ה-`A1 Guardrails` ללא בלבול למשתמש מתחיל

כדי למנוע הן "אזעקת שווא" (תג אדום/כתום שגוי על הום דיפו או אדובי) והן "היעלמות שקטה" (שעלולה לפגוע באמון כשבאתרים אחרים מופיע הון עצמי שלילי), הכרטיס מפריד בין **הפסיקה הבריאותית** לבין **הקשר החשבונאי (`Tier 3`)**:

1. **קניבלי בייבאק (`HD`, `MCD`, `SBUX`, `LOW`):**
   - **תגית ראשית בכרטיס (ירוק):** `מאזן יציב` / `Sound Balance Sheet`.
   - **ערך מרכזי:** מציג עוגן פירעון אמיתי (למשל `כיסוי ריבית 14.2x` / `N/M (רכישה עצמית)`).
   - **תגית מידע רגועה (`bg-sky-500/10 text-sky-700 dark:text-sky-300`):** `ℹ️ הון שלילי מרכישה עצמית — תקין` / `ℹ️ Negative Equity from Buybacks — OK` (אינה נספרת כדגל אדום או צהוב!).
   - **Tooltip במשפט אחד (עברית פשוטה):** *"החברה השתמשה ברווחים אדירים כדי לקנות בחזרה מניות של עצמה, פעולה חשבונאית שמאפסת את ההון העצמי בספרים — אך כל עוד התזרים חיובי והחוב מכוסה בקלות, זהו סימן לעוצמה ולא לפשיטת רגל."*
2. **הכנסות נדחות ב-SaaS (`ADBE`, `CRM`):**
   - **תגית ראשית בכרטיס:** ירוקה `נזילות תקינה` (כשהמתואם `>= 1.5x`) או צהובה `נזילות בינונית` (`1.0x–1.49x`).
   - **ערך מרכזי:** `1.7x (מתואם)` עם הערת משנה `מדווח: 0.9x`.
   - **תגית מידע רגועה:** `ℹ️ תשלומי מנויים מראש — לא חוב` / `ℹ️ Prepaid Subscriptions — Not Debt`.
   - **Tooltip במשפט אחד (עברית פשוטה):** *"הלקוחות כבר שילמו מראש במזומן על מנויים לשנה הקרובה, ובחשבונאות הסכום נרשם כהתחייבות עד למתן השירות — אף שבפועל זהו כסף שכבר בקופה ואינו חוב שיש להחזיר לבנק."*

---

## 4. חוקי 6 הארכיטיפים, פיצול `FINANCIAL_SPREAD`, ריכוזיות והנפקות טריות

### א. ששת האבות-טיפוס (`inferArchetypeFromXbrlAndMeta` מיידי + `businessArchetype` ב-Vertex AI)
1. **`TECH_SAAS`:** מופעל סינון יחס שוטף מתואם על `deferredRevenueCurrent`; דגלים: `Gross Margin < 50%`, `Rule of 40 < 40%`, האטה חדה בצמיחה, `SBC/Rev >= 15%`/`20%`, דילול `> 3%–4%`/שנה, `OCF < 0` + גיוסי הון.
2. **`FINANCIAL_SPREAD` (מפוצל לפי `A2` — "חברת מימון ומרווח פיננסי"):**
   - **מפעיל כרטיס 5 מותנה:** **`Net Profit Margin` (`שולי רווח נקי`) + הקשר `ROE`** (מסביר ב-Tooltip מדוע הוצאות מימון/ריבית יושבות מתחת לרווח התפעולי).
   - **מסלול א׳ — ליסינג, אשראי לא-בנקאי ו-REITs (`AER`):** כיסוי ריבית `(OperatingIncome + InterestExpenseOperating) / TotalInterestExpense` (`< 2.0x` צהוב / `< 1.5x` אדום); מינוף `Liabilities/Equity >= 3.0x` צהוב / **`>= 4.5x` אדום**; התראה על הפסד נקי או `Net Margin < 10%` או `ROE < 10%`.
   - **מסלול ב׳ — בנקים ופינטק מקבלי פיקדונות (`KLAR`):** מדד `Current Ratio` מסומן `N/A` (פיקדונות לקוחות הם התחייבות שוטפת בהגדרה); החלפת `L/E >= 3.0x` ביחס כרית ההון **`Equity / Assets < 6%`** (התראה אדומה על מינוף בנקאי מעבר ל-`16–20x`, לפי אזהרת `20:1` ב*מכתבי באפט*); דגלי איכות `10-K` על `Combined Ratio >= 100%` או זינוק בהפרשות להפסדי אשראי.
3. **`RETAIL_ECOMMERCE`:** החרגת עלות-נמוכה (שוליים תפעוליים `2%–6%` יציבים + `OCF >= NI` אינם נפסלים); דגלים על ניפוח מלאי (`Inventory YoY > Revenue YoY + 10%`) או שחיקת שוליים גולמיים/תפעוליים (`>= 2–3` נק׳ אחוז).
4. **`CYCLICAL_INDUSTRIAL`:** מלכודת שיא המחזור (`max - min > 20` נק׳ אחוז), שנת הפסד במחזור (`min < 0%`), `CapEx / OCF >= 70%`, כיסוי ריבית `< 5.0x` בשנה חלשה (ציטוט *The Parade on Tiptoes* של באפט).
5. **`HEALTHCARE_PHARMA`:** `Pre-Revenue` (`Revenue == 0`) או `OCF < 0` עם אופק מזומנים `< 8` רבעונים ("על זמן שאול"), אירוע בינארי (FDA/תלות במוצר יחיד, צוק פטנטים ב-`10-K`).
6. **`STAPLES_GENERAL`:** צמיחה תת-אינפלציונית (`< 5%`) + `ROIC/ROE <= 10%`; החרגת יחס שוטף ורף חוב עד `D/E <= 2.0` לתשתיות (`Utilities`) מפוקחות.

### ב. חפיר מדומה, ריכוזיות וממשל תאגידי (סריקת `10-K` / `20-F` / `8-K` ב-PR 2)
- הוספת `AI_SUMMARY_SCHEMA_VERSION = 2` (במקום מחיקת `edgar-ai-cache` לפני תשובת שרת ב-`forceRefresh`, ביצוע שדרוג אופורטוניסטי בטוח) ותרגום מלא של דגלים איכותיים ב-`translateSummaryOnDemand()` ([aiSummaryService.js](../../src/services/aiSummaryService.js)).
- זיהוי ריכוזיות לקוחות (`> 10%` צהוב, `> 20%` אדום), חפיר נשחק, `10-K/A` Restatements, עזיבת מנהלים (`8-K 5.02`), תמחור אופציות מחדש, וריכוזיות סוברינית/שרשרת אספקה.

### ג. חוקי הנפקות טריות — `Recent IPOs` (`Issue #332` ב-PR 4)
- ביטול נפילה ל-`DEFAULT_MSFT_TRIAGE`, עמידות מלאה ל-`companyfacts 404` (`ipoMetadataOnly`), חילוץ תשקיף `424B4` / `S-1` / `F-1` + `10-Q` ב-[companyContext.ts](../../functions/src/functions/companyContext.ts) (`ipoFinancialSnapshot` בתגית `חולץ מתשקיף S-1 (לא XBRL)`), תג **`היסטוריה קצרה (< 3 שנים)`**, והתרעת `Lockup` (`6–12` חודשים) עם ציטוטי *המשקיע הנבון* ו*מכתבי באפט*.

---

## 5. תוכנית עבודה ומדרג PRs ב-GitHub (Epic אמון עצמאי — לפני `#336` ולפני Production)

| שלב / PR | סוג וסמנטיקה (SemVer) | תחולה מאושרת וסופית |
| :--- | :--- | :--- |
| **PR 1** | **`fix`** · **`v1.2.6`** *(Patch)* | **תיקוני אמינות, באג `AER`, 5 תיקוני `gaapNormalizer`, גרסאות Cache, BiDi ותיקוני Preview (`#356`, `#362`–`#365`):**<br>• `gaapNormalizer.js`: 5 תיקוני באגים + תגיות חסרות (`InterestExpenseOperating`, `InterestPaidNet`, `stockBasedCompensation`, `deferredRevenueCurrent`, `ProfitLossBeforeTax`, `InterestRevenueExpense`), חישובים נגזרים ל-`totalLiabilities` ו-`totalDebt`, סינון משך זמן (`300–420` יום שנתי / `60–120` יום רבעוני) + העדפת `frame`, וקידום ל-`NORMALIZATION_VERSION = 3` (`#356`, `#362`).<br>• `edgarCache.js` & `cacheWriter.ts`/`cacheCoordinator.js`: קידום ל-`DB_VERSION = 5`, אכיפת `normalizationVersion` ב-`isValidCacheEntry()`, טיפול ב-`onblocked`, והחזרת `{ updated: false, skippedReason: 'too_large' }` מעל `900_000` בתים ללא HTTP `429` (`#356`, `#362`, `#365`).<br>• `triageCalculator.js`: הסרת `DEFAULT_MSFT_TRIAGE` (מצב `unavailable`), מנוע Weakest-Link 3 מצבים (`pass`/`warn`/`fail`/`unavailable`), כיול מחזוריות להתרחבות מרווחים vs קריסת שיא-לשפל (`MSFT` עובר, `AER` נכשל), יישור עיגול ותווית הפסקת בייבאקס (`HD` `+0.2%`), תווית `"(שנה אחרונה / YoY)"`, ומפריד `|` במקום `·` (`#356`, `#362`–`#364`).<br>• `Step1Triage.jsx`: החלפת `BidiText` לטוקנייזר `exec()` לינארי ללא lookbehind (תיקון `ל-48.0%-`), עיצוב 4 מצבים, מקרא סטטוס נפרד (`fundamentals-status-legend`) ו-Tooltips מובנים בעברית פשוטה (`#356`, `#364`). |
| **PR 2** | **`feat`** · **`v1.3.0`** *(Minor)* | **מנוע Inversion & Red-Flags, `A1` Guardrails, `A3` אופציה C היברידית וציטוטי באפט/גראהם:**<br>• `AI_SUMMARY_SCHEMA_VERSION = 2` + שדרוג אופורטוניסטי ללא מחיקת Cache מוקדמת + סיווג `businessArchetype` דטרמיניסטי מיידי (`200ms`).<br>• יישום מלא של Guardrails (`A1`: קניבלי בייבאק + הכנסות נדחות SaaS עם תגיות `ℹ️` כחולות; `3Y` Roll-up/SBC/Dividend).<br>• יישום אופציה C ההיברידית (`A3`): פס `40px` עליון ב-Tear Sheet + כרטיס `#step1-risk-breakdown` מעל Gatekeeper מלוקלז, עם הסברים לימודיים בעברית פשוטה. |
| **PR 3** | **`feat`** · **`v1.4.0`** *(Minor)* | **כרטיס 5 מותנה (`Net Profit Margin` + `ROE`), פיצול `FINANCIAL_SPREAD` והרחבת רוחב ל-`max-w-6xl`:**<br>• הצגת כרטיס 5 עבור `FINANCIAL_SPREAD`, פיצול חוקים בין ליסינג (`AER`, `L/E >= 4.5x`) לבנקים מקבלי פיקדונות (`KLAR`, `Equity/Assets < 6%`, `Current Ratio = N/A`), והרחבת הגריד ל-`xl:grid-cols-5`. |
| **Gate** | **אימות Staging + Production** | **אימות משותף על Staging (`AER`, `SAP`, `MSFT`, `HD`, `ADBE`, `KLAR`) ורק אז קידום `PR #317` (`develop -> main`).** |
| **PR 4** | **`feat`** · **`v1.5.0`** *(Minor)* | **העברת `Issue #332` (`Recent IPO Mode`) מ-`#336` לאפיק האמון.** |
| **PR 5** | **`feat`** · **`v1.6.0`** *(Minor)* | **תמלולי שיחות משקיעים ב-Step 1 (`A4`):** העלאת קובץ ב-UI + Endpoint מאובטח לצינור הפרטי (`companyContext/{ticker}`) תחילה, לצד גיבוי `8-K Item 2.02`. |
| **PR 6** | **`feat`** · **`v1.7.0`** *(Minor)* | **כרטיס שיתוף כתמונה (`A4`):** רינדור מקומי ב-Canvas 2D ללא תלות חיצונית (`1200×630`), הכולל Fallback למונוגרמה/CORS ו-`ClipboardItem` סינכרוני + `navigator.share` / PNG. |
