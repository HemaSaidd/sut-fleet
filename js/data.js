/**
 * UniFleet Safety - Master Dataset
 * جامعة السويدي للتكنولوجيا (Elsewedy University of Technology - SUT)
 * شبكة خطوط النقل الرسمية المعتمدة
 */

const FLEET_DATA = {
  // University Info & Branding
  university: {
    nameAr: "جامعة السويدي للتكنولوجيا",
    nameEn: "Elsewedy University of Technology (SUT)",
    department: "إدارة السلامة والأمان والنقل الطلابي - غرفة 112",
    hotline: "01040772030 (إدارة النقل)",
    campusLocation: "طريق مصر الإسماعيلية الصحراوي - العاشر من رمضان",
    defaultHost: (typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('file')) 
      ? window.location.origin 
      : "http://10.244.47.33:8080"
  },

  // Cloud Realtime Database Config (مفعل الآن سحابياً 100%)
  firebaseConfig: {
    enabled: true,
    apiKey: "AIzaSyBkbZyU_-6-d-9csKu6FklUwHFbfQ3P0Q4",
    authDomain: "sut-fleet.firebaseapp.com",
    databaseURL: "https://sut-fleet-default-rtdb.firebaseio.com",
    projectId: "sut-fleet",
    storageBucket: "sut-fleet.firebasestorage.app",
    messagingSenderId: "327140439270",
    appId: "1:327140439270:web:16cfba9e9332ddb6793727",
    measurementId: "G-JXGMHT1ZKN"
  },

  // University Contractor Companies (شركات النقل المقاولة المعتمدة)
  vendors: [
    {
      id: "VEND-01",
      name: "شركة أبو الهول لنقل الركاب",
      contactPerson: "إدارة تشغيل أسطول السويدي",
      phone: "01040772030",
      activeBuses: 23,
      totalIncidents: 4,
      criticalIncidents: 1,
      finesTotal: 8000,
      safetyScore: 95,
      status: "COMPLIANT"
    },
    {
      id: "VEND-02",
      name: "ترافيل لاين لنقل الركاب",
      contactPerson: "أ/ رأفت سلامة",
      phone: "01129876543",
      activeBuses: 8,
      totalIncidents: 9,
      criticalIncidents: 3,
      finesTotal: 24500,
      safetyScore: 84,
      status: "WARNING"
    },
    {
      id: "VEND-03",
      name: "إكسبريس النور للنقل الجامعي",
      contactPerson: "كابتن/ إيهاب زهران",
      phone: "01234567890",
      activeBuses: 5,
      totalIncidents: 2,
      criticalIncidents: 0,
      finesTotal: 3000,
      safetyScore: 98,
      status: "COMPLIANT"
    }
  ],

  // 23 Official SUT Lines provided by user
  buses: [
    {
      id: "101",
      numberPlate: "باص 101 (ق أ ر 4110)",
      model: "مرسيدس MCV 400 - 33 راكب",
      lineName: "خط العاشر 1",
      vendorId: "VEND-01",
      vendorName: "شركة النيل للنقل",
      driverName: "محمد عبد السلام",
      driverPhone: "01011223344",
      capacity: 33
    },
    {
      id: "102",
      numberPlate: "باص 102 (س ن ل 5521)",
      model: "مرسيدس MCV - 33 راكب",
      lineName: "خط العاشر 2",
      vendorId: "VEND-01",
      vendorName: "شركة النيل للنقل",
      driverName: "ياسر المغاوري",
      driverPhone: "01022334455",
      capacity: 33
    },
    {
      id: "103",
      numberPlate: "باص 103 (د ع ص 7819)",
      model: "باص كبير 50 راكب",
      lineName: "خط الاسماعيلية",
      vendorId: "VEND-02",
      vendorName: "ترافيل لاين",
      driverName: "إبراهيم الدسوقي",
      driverPhone: "01133445566",
      capacity: 50
    },
    {
      id: "104",
      numberPlate: "باص 104 (ف ط ر 3302)",
      model: "مرسيدس MCV - 33 راكب",
      lineName: "خط السويس",
      vendorId: "VEND-02",
      vendorName: "ترافيل لاين",
      driverName: "محمود عبد الرؤوف",
      driverPhone: "01144556677",
      capacity: 33
    },
    {
      id: "105",
      numberPlate: "باص 105 (ج ل ق 9012)",
      model: "باص 33 راكب",
      lineName: "خط ميت غمر",
      vendorId: "VEND-03",
      vendorName: "إكسبريس النور",
      driverName: "طارق الشربيني",
      driverPhone: "01255667788",
      capacity: 33
    },
    {
      id: "106",
      numberPlate: "باص 106 (ب هـ م 6620)",
      model: "مرسيدس باص كبير - 50 راكب",
      lineName: "خط التجمع",
      vendorId: "VEND-01",
      vendorName: "شركة النيل للنقل",
      driverName: "سامح الأباصيري",
      driverPhone: "01066778899",
      capacity: 50
    },
    {
      id: "107",
      numberPlate: "باص 107 (ر ع ل 1184)",
      model: "ميني باص 29 راكب",
      lineName: "خط الرحاب",
      vendorId: "VEND-02",
      vendorName: "ترافيل لاين",
      driverName: "كرم الجندي",
      driverPhone: "01177889900",
      capacity: 29
    },
    {
      id: "108",
      numberPlate: "باص 108 (م ص ق 8432)",
      model: "مرسيدس 33 راكب",
      lineName: "خط الشروق",
      vendorId: "VEND-01",
      vendorName: "شركة النيل للنقل",
      driverName: "عصام البنا",
      driverPhone: "01088990011",
      capacity: 33
    },
    {
      id: "109",
      numberPlate: "باص 109 (ط ي ن 4501)",
      model: "مرسيدس 33 راكب",
      lineName: "خط مدينتي",
      vendorId: "VEND-01",
      vendorName: "شركة النيل للنقل",
      driverName: "خالد عبد الرحيم",
      driverPhone: "01099001122",
      capacity: 33
    },
    {
      id: "110",
      numberPlate: "باص 110 (ك ل ج 7719)",
      model: "ميني باص 29 راكب",
      lineName: "خط العبور",
      vendorId: "VEND-03",
      vendorName: "إكسبريس النور",
      driverName: "جمال بدران",
      driverPhone: "01200112233",
      capacity: 29
    },
    {
      id: "111",
      numberPlate: "باص 111 (أ ب ر 2389)",
      model: "باص كبير 50 راكب",
      lineName: "خط جسر السويس",
      vendorId: "VEND-02",
      vendorName: "ترافيل لاين",
      driverName: "مصطفى قاسم",
      driverPhone: "01111223344",
      capacity: 50
    },
    {
      id: "112",
      numberPlate: "باص 112 (س د ف 9028)",
      model: "باص كبير 50 راكب",
      lineName: "خط مصر الجديدة",
      vendorId: "VEND-01",
      vendorName: "شركة النيل للنقل",
      driverName: "أشرف عبد العال",
      driverPhone: "01022331199",
      capacity: 50
    },
    {
      id: "113",
      numberPlate: "باص 113 (ق ر ص 3491)",
      model: "باص كبير 50 راكب",
      lineName: "خط مدينة نصر",
      vendorId: "VEND-01",
      vendorName: "شركة النيل للنقل",
      driverName: "عادل الشاذلي",
      driverPhone: "01033442288",
      capacity: 50
    },
    {
      id: "114",
      numberPlate: "باص 114 (ل م هـ 5510)",
      model: "مرسيدس 33 راكب",
      lineName: "خط العباسية",
      vendorId: "VEND-02",
      vendorName: "ترافيل لاين",
      driverName: "هشام الفقي",
      driverPhone: "01144553377",
      capacity: 33
    },
    {
      id: "115",
      numberPlate: "باص 115 (ط ر و 6721)",
      model: "باص كبير 50 راكب",
      lineName: "خط الهرم -1",
      vendorId: "VEND-02",
      vendorName: "ترافيل لاين",
      driverName: "سيد كمال الأباصيري",
      driverPhone: "01155664488",
      capacity: 50
    },
    {
      id: "116",
      numberPlate: "باص 116 (ع ف ج 8830)",
      model: "مرسيدس 33 راكب",
      lineName: "خط الهرم -2",
      vendorId: "VEND-03",
      vendorName: "إكسبريس النور",
      driverName: "رمضان فوزي",
      driverPhone: "01266775599",
      capacity: 33
    },
    {
      id: "117",
      numberPlate: "باص 117 (ص ب ل 1209)",
      model: "باص كبير 50 راكب",
      lineName: "خط اكتوبر",
      vendorId: "VEND-02",
      vendorName: "ترافيل لاين",
      driverName: "وليد القصاص",
      driverPhone: "01177886600",
      capacity: 50
    },
    {
      id: "118",
      numberPlate: "باص 118 (ن هـ ر 4402)",
      model: "باص كبير 50 راكب",
      lineName: "خط باسوس المرج",
      vendorId: "VEND-01",
      vendorName: "شركة النيل للنقل",
      driverName: "شريف الديب",
      driverPhone: "01088997711",
      capacity: 50
    },
    {
      id: "119",
      numberPlate: "باص 119 (ك م ق 7843)",
      model: "باص كبير 50 راكب",
      lineName: "خط الجيزة دائري",
      vendorId: "VEND-02",
      vendorName: "ترافيل لاين",
      driverName: "تامر الشناوي",
      driverPhone: "01199008822",
      capacity: 50
    },
    {
      id: "120",
      numberPlate: "باص 120 (ي س ف 3098)",
      model: "مرسيدس 33 راكب",
      lineName: "خط المعادي 1",
      vendorId: "VEND-01",
      vendorName: "شركة النيل للنقل",
      driverName: "حسين المليجي",
      driverPhone: "01000119933",
      capacity: 33
    },
    {
      id: "121",
      numberPlate: "باص 121 (د ط ع 5590)",
      model: "مرسيدس 33 راكب",
      lineName: "خط المعادي 2",
      vendorId: "VEND-03",
      vendorName: "إكسبريس النور",
      driverName: "ماهر قطب",
      driverPhone: "01211220044",
      capacity: 33
    },
    {
      id: "122",
      numberPlate: "باص 122 (ب ر س 9871)",
      model: "مرسيدس 33 راكب",
      lineName: "خط حلوان",
      vendorId: "VEND-03",
      vendorName: "إكسبريس النور",
      driverName: "عاطف النجار",
      driverPhone: "01222331155",
      capacity: 33
    },
    {
      id: "123",
      numberPlate: "باص 123 (ص ع ك 6614)",
      model: "باص كبير 50 راكب",
      lineName: "خط بنها منيا القمح",
      vendorId: "VEND-01",
      vendorName: "شركة النيل للنقل",
      driverName: "فتحي الدمرداش",
      driverPhone: "01033442266",
      capacity: 50
    }
  ],

  // Safety Violation Categories
  violationTypes: [
    {
      code: "PHONE_USAGE",
      icon: "📱",
      title: "استخدام الموبايل أثناء السير",
      riskLabel: "خطر حرج 🔴",
      defaultSeverity: "CRITICAL",
      standardFine: 3000,
      penaltyDescription: "غرامة فورية على المقاول + إنذار نهائي للسائق بالإيقاف"
    },
    {
      code: "RECKLESS_SPEED",
      icon: "⚡",
      title: "سرعة زائدة وغرز متهورة",
      riskLabel: "خطر حرج 🔴",
      defaultSeverity: "CRITICAL",
      standardFine: 4000,
      penaltyDescription: "تطبيق غرامة الفئة (أ) واستدعاء لمقر إدارة الحركة بجامعة السويدي"
    },
    {
      code: "SMOKING_CABIN",
      icon: "🚬",
      title: "التدخين داخل الحافلة",
      riskLabel: "مخالفة صريحة 🟠",
      defaultSeverity: "MEDIUM",
      standardFine: 1500,
      penaltyDescription: "غرامة بيئية وصحية على السائق تخصم من مستخلص الشركة"
    },
    {
      code: "TAILGATING_SIGNALS",
      icon: "🛑",
      title: "تجاوز الإشارات / عدم ترك مسافة أمان",
      riskLabel: "خطر حرج 🔴",
      defaultSeverity: "CRITICAL",
      standardFine: 3500,
      penaltyDescription: "إنذار مشدد وتحويل للتحقيق الميداني"
    },
    {
      code: "AC_FAILURE",
      icon: "❄️",
      title: "عطل بالتكييف / حرارة خانقة",
      riskLabel: "جودة خدمة 🔵",
      defaultSeverity: "LOW",
      standardFine: 1000,
      penaltyDescription: "إلزام بتصليح فوري خلال 24 ساعة أو استبدال الحافلة"
    },
    {
      code: "DRIVER_MISCONDUCT",
      icon: "🗣️",
      title: "مشادة كلامية / سوء معاملة للطلاب",
      riskLabel: "سلوك غير لائق 🟠",
      defaultSeverity: "MEDIUM",
      standardFine: 2000,
      penaltyDescription: "استبعاد السائق عن خطوط جامعة السويدي فوراً واستبداله"
    },
    {
      code: "MECHANICAL_SOUNDS",
      icon: "⚠️",
      title: "أصوات فرامل حادة / عطل ميكانيكي ظاهر",
      riskLabel: "أمان المركبة 🔴",
      defaultSeverity: "CRITICAL",
      standardFine: 2500,
      penaltyDescription: "فحص فني فوري واستبدال احتياطي للباص"
    },
    {
      code: "OVERCROWDING",
      icon: "👥",
      title: "حمولة زائدة / ركوب طلاب وقوفاً",
      riskLabel: "مخالفة سلامة 🟠",
      defaultSeverity: "MEDIUM",
      standardFine: 2000,
      penaltyDescription: "توفير ميني باص تعزيزي على الخط"
    }
  ],

  // Initial Incidents (Realistic University Line Samples)
  initialIncidents: [
    {
      id: "SUT-9102",
      timestamp: "منذ 6 دقائق",
      isoDate: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
      busId: "101",
      busPlate: "باص 101",
      lineName: "خط العاشر 1",
      vendorId: "VEND-01",
      vendorName: "شركة النيل للنقل",
      driverName: "محمد عبد السلام",
      driverPhone: "01011223344",
      violationCode: "PHONE_USAGE",
      violationTitle: "استخدام الموبايل أثناء السير",
      violationIcon: "📱",
      severity: "CRITICAL",
      location: "طريق مصر الإسماعيلية الصحراوي قبل بوابة العاشر",
      notes: "السائق ماسك الموبايل بيتفرج على فيديوهات والسرعة عالية على الصحراوي والأتوبيس بيحود.",
      hasAttachment: true,
      attachmentType: "image",
      attachmentUrl: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&auto=format&fit=crop&q=80",
      isAnonymous: false,
      studentName: "أحمد تامر - كلية تكنولوجيا الهندسة SUT",
      studentPhone: "01099887711",
      status: "NEW",
      actionsTaken: []
    },
    {
      id: "SUT-9098",
      timestamp: "منذ 22 دقيقة",
      isoDate: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
      busId: "106",
      busPlate: "باص 106",
      lineName: "خط التجمع",
      vendorId: "VEND-01",
      vendorName: "شركة النيل للنقل",
      driverName: "سامح الأباصيري",
      driverPhone: "01066778899",
      violationCode: "RECKLESS_SPEED",
      violationTitle: "سرعة زائدة وغرز متهورة",
      violationIcon: "⚡",
      severity: "CRITICAL",
      location: "الطريق الدائري الأوسطي مخرج السويس",
      notes: "سرعة الأتوبيس فوق 110 كم/س وتجاوز خطر وغرز مفاجئة بين الشاحنات.",
      hasAttachment: true,
      attachmentType: "image",
      attachmentUrl: "https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=800&auto=format&fit=crop&q=80",
      isAnonymous: true,
      studentName: "طالب بجامعة السويدي (مجهول)",
      studentPhone: "",
      status: "INVESTIGATING",
      actionsTaken: [
        { time: "منذ 10 دقائق", user: "غرفة عمليات SUT", text: "تم التواصل مع مشرف خط التجمع لإلزام السائق بالتهدئة ومراقبة عداد السرعة عبر الـ GPS." }
      ]
    },
    {
      id: "SUT-9085",
      timestamp: "منذ 45 دقيقة",
      isoDate: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      busId: "123",
      busPlate: "باص 123",
      lineName: "خط بنها منيا القمح",
      vendorId: "VEND-01",
      vendorName: "شركة النيل للنقل",
      driverName: "فتحي الدمرداش",
      driverPhone: "01033442266",
      violationCode: "SMOKING_CABIN",
      violationTitle: "التدخين داخل الحافلة",
      violationIcon: "🚬",
      severity: "MEDIUM",
      location: "طريق بنها - الزقازيق الزراعي",
      notes: "السائق يقوم بالتدخين داخل الكابينة والدخان يملأ الصالون رغم اعتراض الطلاب.",
      hasAttachment: false,
      attachmentType: null,
      attachmentUrl: null,
      isAnonymous: false,
      studentName: "مريم حسام - SUT",
      studentPhone: "01122334455",
      status: "FINED",
      actionsTaken: [
        { time: "منذ 25 دقيقة", user: "إدارة الحركة بجامعة السويدي", text: "توقيع غرامة فورية بقيمة 1,500 ج.م على شركة النيل للنقل وتحذير السائق." }
      ]
    }
  ]
};

// Violation Recurring Counts for Analytics
const VIOLATION_STATISTICS = [
  { title: "استخدام الموبايل أثناء القيادة", count: 31, percentage: 40, colorClass: "bg-red" },
  { title: "سرعة زائدة وغرز على الطرق السريعة", count: 24, percentage: 31, colorClass: "bg-red" },
  { title: "التدخين داخل الحافلة", count: 11, percentage: 14, colorClass: "bg-amber" },
  { title: "أعطال التكييف والنظافة", count: 8, percentage: 10, colorClass: "bg-blue" },
  { title: "سلوك غير لائق أو تأخير في المواعيد", count: 4, percentage: 5, colorClass: "bg-amber" }
];
