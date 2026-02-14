import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./locales/en/common.json";
import enDashboard from "./locales/en/dashboard.json";
import enSetup from "./locales/en/setup.json";
import enCourseNew from "./locales/en/courseNew.json";
import enCourseOverview from "./locales/en/courseOverview.json";
import enLesson from "./locales/en/lesson.json";
import enQuiz from "./locales/en/quiz.json";
import enDiagnostic from "./locales/en/diagnostic.json";
import enChat from "./locales/en/chat.json";
import enScratchpad from "./locales/en/scratchpad.json";
import enNotebook from "./locales/en/notebook.json";
import enLessonContent from "./locales/en/lessonContent.json";
import enProgress from "./locales/en/progress.json";
import enCompletion from "./locales/en/completion.json";
import enLogin from "./locales/en/login.json";
import enExport from "./locales/en/export.json";
import enRedeem from "./locales/en/redeem.json";
import enAdmin from "./locales/en/admin.json";
import enGallery from "./locales/en/gallery.json";
import enPricing from "./locales/en/pricing.json";

import plCommon from "./locales/pl/common.json";
import plDashboard from "./locales/pl/dashboard.json";
import plSetup from "./locales/pl/setup.json";
import plCourseNew from "./locales/pl/courseNew.json";
import plCourseOverview from "./locales/pl/courseOverview.json";
import plLesson from "./locales/pl/lesson.json";
import plQuiz from "./locales/pl/quiz.json";
import plDiagnostic from "./locales/pl/diagnostic.json";
import plChat from "./locales/pl/chat.json";
import plScratchpad from "./locales/pl/scratchpad.json";
import plNotebook from "./locales/pl/notebook.json";
import plLessonContent from "./locales/pl/lessonContent.json";
import plProgress from "./locales/pl/progress.json";
import plCompletion from "./locales/pl/completion.json";
import plLogin from "./locales/pl/login.json";
import plExport from "./locales/pl/export.json";
import plRedeem from "./locales/pl/redeem.json";
import plAdmin from "./locales/pl/admin.json";
import plGallery from "./locales/pl/gallery.json";
import plPricing from "./locales/pl/pricing.json";

i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      dashboard: enDashboard,
      setup: enSetup,
      courseNew: enCourseNew,
      courseOverview: enCourseOverview,
      lesson: enLesson,
      quiz: enQuiz,
      diagnostic: enDiagnostic,
      chat: enChat,
      scratchpad: enScratchpad,
      notebook: enNotebook,
      lessonContent: enLessonContent,
      progress: enProgress,
      completion: enCompletion,
      login: enLogin,
      export: enExport,
      redeem: enRedeem,
      admin: enAdmin,
      gallery: enGallery,
      pricing: enPricing,
    },
    pl: {
      common: plCommon,
      dashboard: plDashboard,
      setup: plSetup,
      courseNew: plCourseNew,
      courseOverview: plCourseOverview,
      lesson: plLesson,
      quiz: plQuiz,
      diagnostic: plDiagnostic,
      chat: plChat,
      scratchpad: plScratchpad,
      notebook: plNotebook,
      lessonContent: plLessonContent,
      progress: plProgress,
      completion: plCompletion,
      login: plLogin,
      export: plExport,
      redeem: plRedeem,
      admin: plAdmin,
      gallery: plGallery,
      pricing: plPricing,
    },
  },
  lng: "en",
  fallbackLng: "en",
  defaultNS: "common",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
