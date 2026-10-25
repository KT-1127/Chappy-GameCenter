// チャッピーGameセンターの設定（管理者が書きかえるのはここだけ）
//
// firebase: Firebase コンソール →「プロジェクトの設定」→「マイアプリ（ウェブ）」に出る firebaseConfig をそのまま貼る。
//   null のまま → おためしモード（記録はこの端末のブラウザの中だけ。管理者パスワードは chappy）
//   貼る       → Firestore に記録され、クラス全員のランキング・管理者の設定が共有される
//
// 例:
// firebase: {
//   apiKey: "AIza...",
//   authDomain: "chappy-game-center.firebaseapp.com",
//   projectId: "chappy-game-center",
//   storageBucket: "chappy-game-center.appspot.com",
//   messagingSenderId: "1234567890",
//   appId: "1:1234567890:web:abcdef"
// },
window.CGC_CONFIG = {
  firebase: {
    apiKey: "AIzaSyAURh4jxM4VL_wk4UdC0q797Cvjz3U7zaE",
    authDomain: "chappy-gamecenter.firebaseapp.com",
    projectId: "chappy-gamecenter",
    storageBucket: "chappy-gamecenter.firebasestorage.app",
    messagingSenderId: "478412627816",
    appId: "1:478412627816:web:78eaa9dd854162855940dd"
  },
  siteName: "チャッピーGameセンター"
};
