/**
 * translations.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for every user-visible string in the app.
 *
 * HOW TO ADD A NEW KEY
 *   1. Add the English value under `en { … }`.
 *   2. Add the Spanish value under `es { … }` (same key name).
 *   3. Use  t('yourNewKey')  anywhere a component calls useLanguage().
 *
 * HOW TO EDIT AN EXISTING STRING
 *   Search for the key name and update the value(s) you need to change.
 *   The key itself must remain identical in both language blocks.
 *
 * SECTION MAP
 *   App name · Common · Language Selection · Auth · Dashboard ·
 *   Alerts (user view) · Alert fields · Configuration · Sorting ·
 *   Ticker Names · Accounts Management · Extras · Profile ·
 *   Notifications · Risk Profile · Conditions (legacy) · Terms & Conditions
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const translations = {
  en: {

    // ── App name ──────────────────────────────────────────────────────────────
    appName: 'RDS Inversiones',

    // ── Common ────────────────────────────────────────────────────────────────
    cancel: 'Cancel',
    close: 'Close',
    add: 'Add',
    update: 'Update',
    delete: 'Delete',
    save: 'Save',
    confirm: 'Confirm',
    error: 'Error',
    success: 'Success',
    loading: 'Loading...',
    legal: 'Legal',

    // ── Language Selection ────────────────────────────────────────────────────
    selectLanguage: 'Select Language',
    selectLanguageSubtitle: 'Choose your preferred language',
    english: 'English',
    spanish: 'Spanish',
    continue: 'Continue',

    // ── Auth ──────────────────────────────────────────────────────────────────
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    signIn: 'Sign In',
    register: 'Register',
    alreadyHaveAccount: 'Already have an account? Sign In',
    newUser: 'New user? Register',
    verificationCode: 'Verification Code',
    sendCode: 'Send Code',
    verifyAndRegister: 'Verify & Register',
    enterEmail: 'Please enter your email',
    enterPassword: 'Please enter email and password',
    passwordMinLength: 'Password must be at least 6 characters',
    passwordsDoNotMatch: 'Passwords do not match',
    enterVerificationCode: 'Please enter the verification code',
    verificationCodeSent: 'Verification code sent to your email',
    keepSignedIn: 'Keep me signed in',
    keepSignedInNote: 'Admin and Dev accounts always require sign-in on every session.',
    forgotPassword: 'Forgot your password?',
    forgotPasswordTitle: 'Reset Password',
    forgotPasswordSubtitle: 'Enter your email to receive a verification code',
    forgotPasswordOtpSubtitle: 'Enter the code sent to your email',
    forgotPasswordNewTitle: 'Create New Password',
    forgotPasswordNewSubtitle: 'Choose a strong password for your account',
    newPassword: 'New Password',
    confirmNewPassword: 'Confirm New Password',
    resetPasswordSuccess: 'Your password has been reset successfully',
    passwordResetNotAvailable: 'Password reset is only available for Free and Affiliate accounts',
    setNewPassword: 'Set New Password',

    // ── Dashboard ─────────────────────────────────────────────────────────────
    dashboard: 'Dashboard',
    alertsOverview: 'Alerts Overview',
    noAlertsInList: 'No alerts yet',
    addAlertsToSee: 'Alerts will appear here once created',
    alerts: 'Alerts',
    totalAlerts: 'Total Alerts',
    currentAlerts: 'Current',
    closedAlerts: 'Closed',

    // ── Alerts (user view) ────────────────────────────────────────────────────
    myAlerts: 'Alerts',
    noAlerts: 'No alerts',
    noAlertsSubtitle: 'Alerts will appear here when created by your administrator',
    updated: 'Updated',

    // ── Alert fields ──────────────────────────────────────────────────────────
    ticker: 'Ticker',
    action: 'Action',
    entryPrice: 'Entry Price',
    currentPrice: 'Current Price',
    closingPrice: 'Closing Price',
    threeMonthsGoal: '3-Month Goal',
    openingDate: 'Opening Date',
    closingDate: 'Closing Date',
    alertCondition: 'Condition',
    targetAccounts: 'Target Accounts',
    yieldLabel: 'Yield',
    elapsedTime: 'Elapsed',
    conditionCurrent: 'Current',
    conditionClosed: 'Closed',
    actionBuy: 'Buy',
    actionSell: 'Sell',
    actionRefrain: 'Refrain',
    targetSubscribers: 'Subscribers',
    targetFreeAccounts: 'Free-Accounts',
    actionConservative: 'Conservative',
    actionModerate: 'Moderate',
    actionRisky: 'Aggressive',
    actionHighRisk: 'High Risk',
    reEntryPrice: 'Re-Entry Price',
    marketFilter: 'Market Filter',
    marketFilterSubtitle: 'Choose which markets to display',
    marketAll: 'All Markets',
    marketEEUU: 'USA (US$)',
    marketARG: 'Arg (AR$)',
    market: 'Market',

    // ── Configuration — Alerts management ────────────────────────────────────
    configuration: 'Config.',
    manageAlerts: 'Manage alerts',
    addNewAlert: 'New Alert',
    updateAlert: 'Update Alert',
    closeAlert: 'Close Alert',
    closingPriceLabel: 'Closing Price',
    noAlertsConfigured: 'No alerts configured',
    addAlertsToStart: 'Create the first alert to get started',
    alertAddedSuccess: 'Alert created successfully',
    alertUpdatedSuccess: 'Alert updated successfully',
    alertClosedSuccess: 'Alert closed successfully',
    alertDeletedSuccess: 'Alert deleted successfully',
    confirmDeleteAlert: 'Delete alert for',

    // ── Sorting ───────────────────────────────────────────────────────────────
    sortBy: 'Sort by',
    alphabeticalAZ: 'A-Z',
    alphabeticalZA: 'Z-A',
    newestFirst: 'Newest First',
    oldestFirst: 'Oldest First',
    currentFirst: 'Current First',
    closedFirst: 'Closed First',

    // ── Ticker Names ──────────────────────────────────────────────────────────
    tickerNames: 'Tickers Info',
    addTickerName: 'Add Ticker Info',
    noTickerNames: 'No Ticker Names',
    tickerSymbol: 'Ticker Symbol',
    companyName: 'Company Name',

    // ── Accounts Management ───────────────────────────────────────────────────
    accountsManagement: 'Accounts',
    manageAccounts: 'Manage user accounts',
    addAccount: 'Add Account',
    editAccount: 'Edit Account',
    emailAddress2: 'Email Address',
    selectAccountType: 'Account Type',
    noAccountsConfigured: 'No accounts configured',
    addAccountsToStart: 'Add Affiliate or Admin accounts to get started',
    accountAddedSuccess: 'Account added successfully',
    accountUpdatedSuccess: 'Account updated successfully',
    accountDeletedSuccess: 'Account removed successfully',
    confirmDeleteAccount2: 'Remove account for',
    confirmDeleteAccountMsg: 'This will downgrade the user to a Free account.',
    batchImportAccounts: 'Batch import accounts',
    exportAccounts: 'Export accounts list',
    importResultsTitle: 'Import Results',

    // ── Extras ────────────────────────────────────────────────────────────────
    extras: 'Extras',
    resourcesAndContact: 'Additional resources',
    downloadOnPlayStore: 'Download on Play Store',
    balanzInt: 'Balanz International',
    rdsInversionesSub: 'Visit our Website',
    balanzSub: 'Invest with us in Balanz',
    invertirOnlineSub: 'Invest with us in InvertirOnline',
    instagramSub: 'Visit our Instagram account',
    youTubeSub: 'Visit our YouTube channel',

    // ── Profile ───────────────────────────────────────────────────────────────
    profile: 'Profile',
    accountSettings: 'Account settings',
    account: 'Account',
    accountType: 'Account Type',
    preferences: 'Preferences',
    appLanguage: 'App Language',
    changeLanguage: 'Change Language',
    logout: 'Logout',
    deleteAccount: 'Delete Account',
    deleteAccountWarning:
      'This action is permanent and cannot be undone. All your data will be deleted. A verification code will be sent to your email to confirm.',
    sendVerificationCode: 'Send Verification Code',
    verifyToDelete: 'Verify Identity',
    deleteAccountOtpSent: 'A verification code has been sent to',
    deleteAccountOtpResent: 'A new verification code has been sent to your email.',
    deleteAccountConfirm: 'Confirm & Delete Account',
    enterCode: 'Enter code',
    resendCode: 'Resend Code',

    // ── Notifications ─────────────────────────────────────────────────────────
    notifications: 'Notifications',
    notificationsSubtitle: 'Receive push notifications for alerts',
    notificationsEnabled: 'Push Notifications',
    notificationsEnabledDesc: 'Get notified when alerts are created, updated, or closed',
    emailNotificationsEnabled: 'Email Notifications',
    emailNotificationsEnabledDesc: 'Receive emails when alerts are created, updated, or closed',

    // ── Risk Profile ──────────────────────────────────────────────────────────
    riskProfile: 'Risk Profile',
    riskProfileTitle: 'Investment Profile Questionnaire',
    riskProfileSubtitle: 'Help us understand your investment goals',
    riskProfileQuestion1: 'I believe I will need to use a large part of my investment:',
    riskProfileQuestion2: 'I would like the value of this investment to:',
    riskProfileQuestion3: 'In the coming years, I am convinced that my ability to save:',
    riskProfileQuestion4: 'I consider my level of investment knowledge to be:',
    riskProfileQuestion5: 'Current Age',
    riskProfileQuestion6: 'If the value of my investment starts to fall:',
    riskProfileQuestion7: 'The main objective of this investment is:',
    riskProfileQuestion8:
      'With respect to my total assets (real estate, savings, and company shares), this investment represents a percentage:',
    riskProfileQ1A: 'In one (1) year or less',
    riskProfileQ1B: 'Within 1 to 5 years',
    riskProfileQ1C: 'In more than 5 years',
    riskProfileQ2A: 'Be secure and never decrease, even if it does not multiply as much',
    riskProfileQ2B: 'Obtain relatively constant returns, even if it may temporarily decrease',
    riskProfileQ2C: 'Grow significantly regardless of the risks',
    riskProfileQ3A: 'Will decrease',
    riskProfileQ3B: 'Will not vary significantly',
    riskProfileQ3C: 'Will increase',
    riskProfileQ4A: 'Low (I have limited investment experience)',
    riskProfileQ4B:
      'Medium (I have some experience but would like to receive guidance and advice as needed)',
    riskProfileQ4C:
      'High (I feel confident in making investment decisions and I am able to understand and weigh the associated risks)',
    riskProfileQ5A: 'Over 50 years old',
    riskProfileQ5B: 'Between 35 and 50 years old',
    riskProfileQ5C: 'Under 35 years old',
    riskProfileQ6A: 'I sell to avoid further losses',
    riskProfileQ6B: 'I do nothing and would need to consult a specialist',
    riskProfileQ6C: 'I look for resources to invest more; opportunities lie in crises',
    riskProfileQ7A: 'To have savings in case of hard times',
    riskProfileQ7B:
      'To achieve a goal I have set for myself and that I believe I can reach in 3 to 5 years',
    riskProfileQ7C: 'To maintain my standard of living when I no longer work',
    riskProfileQ8A: 'Greater than 60%',
    riskProfileQ8B: 'Between 30% and 60%',
    riskProfileQ8C: 'Less than 30%',
    riskProfileResult: 'Your Risk Profile',
    riskProfileConservativeName: 'Conservative',
    riskProfileModerateName: 'Moderate',
    riskProfileAggressiveName: 'Aggressive',
    riskProfileConservativeDesc:
      'I value security and seek to preserve the initial value of my investment, regardless of whether the perceived return is very high.\n\nRisk Profile of Proposed Investment Funds: Medium-low, Low',
    riskProfileModerateDesc:
      'I desire appreciation of the capital invested, even though market fluctuations may cause a moderate loss. I strive to maintain a balance between profitability and security.\n\nRisk Profile of Proposed Investment Funds: Medium-high, Medium, Medium-low, Low',
    riskProfileAggressiveDesc:
      'I expect high returns, even though this may imply high fluctuations and the possible loss of a significant percentage of the amount invested.\n\nRisk Profile of Proposed Investment Funds: High, Medium-high, Medium, Medium-low, Low',
    riskProfileUnderstood: 'I Understand',
    riskProfileRetake: 'Update',
    riskProfileUpdateBtn: 'Update',
    riskProfileNotSet: 'Not yet determined',
    riskProfileProgress: 'Question {current} of {total}',
    riskProfileNext: 'Next',
    riskProfileSubmit: 'Submit',
    riskProfilePrev: 'Previous',

    // ── Conditions (legacy) ───────────────────────────────────────────────────
    bullish: 'Bullish',
    neutral: 'Neutral',
    bearish: 'Bearish',

    // ── Terms and Conditions ──────────────────────────────────────────────────
    termsAndConditions: 'Terms & Conditions',
    acceptTerms: 'I Accept',
    declineTerms: 'Decline',
    mustAcceptTerms: 'You must accept the Terms and Conditions to continue',
    viewTermsAndConditions: 'View Terms & Conditions',
    scrollToAccept: 'Scroll to the bottom to accept',
    pleaseReadCarefully: 'Please read carefully before continuing',
    termsUpdatedTitle: 'Terms Updated',
    termsUpdatedMessage:
      'Our Terms & Conditions have been updated. Please review and accept the new version to continue.',
    termsVersion: 'Version',
    termsContent: `**Last Updated:** 06/05/2026

**1. Acceptance of Terms & Conditions**

By downloading, accessing, or using this application, you agree to be bound by these Terms and Conditions and Privacy Policy.

If you do not agree, you must not use the App.

**2. Description of Service**

The App provides:
• Trend ratings for financial instruments (e.g., stocks, ETFs, indices)
• Educational and informational financial content

The App is provided free of charge and may evolve over time.

**3. No Financial Advice**

All content provided through the App is for informational and educational purposes only and does not constitute financial, investment, legal, or tax advice.

The App does not consider your financial situation, objectives, or risk tolerance, and no fiduciary relationship exists between you and the App provider.


**4. Investment Risk Disclosure**

Investing in financial markets involves substantial risk, including loss of capital, market volatility, liquidity risks, and model inaccuracies.

The App’s ratings are based on technical analysis models and assumptions, which may be incorrect, incomplete, or delayed and do not guarantee future performance.

Past performance is not indicative of future results.

You are solely responsible for your investment decisions and any financial outcomes resulting from use of the App.

**5. Limitation of Liability**

To the maximum extent permitted by law, the App provider shall not be liable for financial losses, trading losses, lost profits, service interruptions, data inaccuracies, or indirect damages.

**6. No Warranty**

The App is provided "as is" and "as available" without warranties of any kind, including accuracy, reliability, fitness for a particular purpose, or uninterrupted operation.

**7. User Responsibilities**

You agree not to rely solely on the App for investment decisions, to conduct your own research or consult professionals, and to comply with applicable financial regulations.

**8. Third-Party Data & Services**

The App may use third-party market data and analytics services. The provider does not guarantee the accuracy or completeness of third-party data and is not responsible for third-party outages or errors.

**9. Intellectual Property**

All algorithms, ratings methodologies, designs, and interfaces are the property of the App provider and may not be copied, reproduced, distributed, or reverse-engineered.

**10. Modifications and Termination**

The provider may modify the App or these Terms at any time and may suspend or terminate access without prior notice. Continued use constitutes acceptance of changes.

**PRIVACY POLICY**

**11. Data Controller**

The App provider is the data controller responsible for processing your personal data.

Contact: theappswarehouse@gmail.com

**12. Data Collected**

The App may collect:
• Email address (where applicable)
• Device and usage data
• Analytics and performance data

**13. Use of Data**

Data is used to operate App functions, analyze usage and performance, communicate important updates, manage accounts, and improve security.

**14. Tracking & Analytics**

The App may use analytics and crash-reporting tools, including Google Analytics, Firebase Analytics, or similar technologies. These tools may collect anonymized usage information.

**15. Data Sharing**

Your data is not sold. It may be shared with service providers or legal authorities when required by law.

**16. International Data Transfers**

Data may be processed outside your country with appropriate safeguards in accordance with applicable regulations.

**17. Data Retention**

Data is retained only as long as necessary to provide services and comply with legal obligations.

**18. Your Rights**

Depending on your jurisdiction, you may have the right to access, rectify, delete, object to processing, and withdraw consent regarding your personal data.

Under Argentina Law 25.326, you may access your personal data free of charge at intervals not less than six months.

**19. Data Security**

Reasonable technical and organizational measures are used to protect personal data; however, no system is completely secure.

**20. Children’s Privacy**

The App is not intended for users under 18 years of age, and no data is knowingly collected from minors.

**21. Google Play Compliance**

The App complies with Google Play Developer Policies, data safety requirements, and user data transparency obligations.

**22. Changes to Privacy Policy**

This Privacy Policy may be updated periodically. Continued use implies acceptance of any changes.

**Contact:** theappswarehouse@gmail.com`,
  },

  // ════════════════════════════════════════════════════════════════════════════
  es: {

    // ── App name ──────────────────────────────────────────────────────────────
    appName: 'RDS Inversiones',

    // ── Common ────────────────────────────────────────────────────────────────
    cancel: 'Cancelar',
    close: 'Cerrar',
    add: 'Agregar',
    update: 'Actualizar',
    delete: 'Eliminar',
    save: 'Guardar',
    confirm: 'Confirmar',
    error: 'Error',
    success: 'Éxito',
    loading: 'Cargando...',
    legal: 'Legal',

    // ── Language Selection ────────────────────────────────────────────────────
    selectLanguage: 'Seleccionar Idioma',
    selectLanguageSubtitle: 'Elige tu idioma preferido',
    english: 'Inglés',
    spanish: 'Español',
    continue: 'Continuar',

    // ── Auth ──────────────────────────────────────────────────────────────────
    email: 'Correo Electrónico',
    password: 'Contraseña',
    confirmPassword: 'Confirmar Contraseña',
    signIn: 'Iniciar Sesión',
    register: 'Registrarse',
    alreadyHaveAccount: '¿Ya tienes una cuenta? Iniciar Sesión',
    newUser: '¿Nuevo usuario? Registrarse',
    verificationCode: 'Código de Verificación',
    sendCode: 'Enviar Código',
    verifyAndRegister: 'Verificar y Registrar',
    enterEmail: 'Por favor ingresa tu correo electrónico',
    enterPassword: 'Por favor ingresa correo y contraseña',
    passwordMinLength: 'La contraseña debe tener al menos 6 caracteres',
    passwordsDoNotMatch: 'Las contraseñas no coinciden',
    enterVerificationCode: 'Por favor ingresa el código de verificación',
    verificationCodeSent: 'Código de verificación enviado a tu correo',
    keepSignedIn: 'Mantener sesión iniciada',
    keepSignedInNote: 'Las cuentas Admin y Dev siempre requieren inicio de sesión en cada sesión.',
    forgotPassword: '¿Olvidé mi contraseña?',
    forgotPasswordTitle: 'Restablecer Contraseña',
    forgotPasswordSubtitle: 'Ingresa tu correo para recibir un código de verificación',
    forgotPasswordOtpSubtitle: 'Ingresa el código enviado a tu correo',
    forgotPasswordNewTitle: 'Crear Nueva Contraseña',
    forgotPasswordNewSubtitle: 'Elige una contraseña segura para tu cuenta',
    newPassword: 'Nueva Contraseña',
    confirmNewPassword: 'Confirmar Nueva Contraseña',
    resetPasswordSuccess: 'Tu contraseña ha sido restablecida exitosamente',
    passwordResetNotAvailable:
      'El restablecimiento de contraseña solo está disponible para cuentas Free y Affiliate',
    setNewPassword: 'Establecer Nueva Contraseña',

    // ── Dashboard ─────────────────────────────────────────────────────────────
    dashboard: 'Panel',
    alertsOverview: 'Resumen de Alertas',
    noAlertsInList: 'Sin alertas aún',
    addAlertsToSee: 'Las alertas aparecerán aquí cuando sean creadas',
    alerts: 'Alertas',
    totalAlerts: 'Total de Alertas',
    currentAlerts: 'Vigentes',
    closedAlerts: 'Cerradas',

    // ── Alerts (user view) ────────────────────────────────────────────────────
    myAlerts: 'Alertas',
    noAlerts: 'Sin alertas',
    noAlertsSubtitle: 'Las alertas aparecerán aquí cuando sean creadas por tu administrador',
    updated: 'Actualizado',

    // ── Alert fields ──────────────────────────────────────────────────────────
    ticker: 'Ticker',
    action: 'Acción',
    entryPrice: 'Precio de Entrada',
    currentPrice: 'Precio Actual',
    closingPrice: 'Precio de Cierre',
    threeMonthsGoal: 'Objetivo 3 Meses',
    openingDate: 'Fecha de Apertura',
    closingDate: 'Fecha de Cierre',
    alertCondition: 'Condición',
    targetAccounts: 'Cuentas Objetivo',
    yieldLabel: 'Rendimiento',
    elapsedTime: 'Tiempo',
    conditionCurrent: 'Vigente',
    conditionClosed: 'Cerrada',
    actionBuy: 'Comprar',
    actionSell: 'Vender',
    actionRefrain: 'Abstenerse',
    targetSubscribers: 'Suscriptores',
    targetFreeAccounts: 'Cuentas Gratuitas',
    actionConservative: 'Conservador',
    actionModerate: 'Moderado',
    actionRisky: 'Agresivo',
    actionHighRisk: 'Alto Riesgo',
    reEntryPrice: 'Precio Re-Entrada',
    marketFilter: 'Filtro de Mercado',
    marketFilterSubtitle: 'Elige qué mercados mostrar',
    marketAll: 'Todos los Mercados',
    marketEEUU: 'EEUU (US$)',
    marketARG: 'Arg (AR$)',
    market: 'Mercado',

    // ── Configuration — Alerts management ────────────────────────────────────
    configuration: 'Config.',
    manageAlerts: 'Gestionar alertas',
    addNewAlert: 'Nueva Alerta',
    updateAlert: 'Actualizar Alerta',
    closeAlert: 'Cerrar Alerta',
    closingPriceLabel: 'Precio de Cierre',
    noAlertsConfigured: 'No hay alertas configuradas',
    addAlertsToStart: 'Crea la primera alerta para comenzar',
    alertAddedSuccess: 'Alerta creada exitosamente',
    alertUpdatedSuccess: 'Alerta actualizada exitosamente',
    alertClosedSuccess: 'Alerta cerrada exitosamente',
    alertDeletedSuccess: 'Alerta eliminada exitosamente',
    confirmDeleteAlert: 'Eliminar alerta de',

    // ── Sorting ───────────────────────────────────────────────────────────────
    sortBy: 'Ordenar por',
    alphabeticalAZ: 'A-Z',
    alphabeticalZA: 'Z-A',
    newestFirst: 'Más Recientes',
    oldestFirst: 'Más Antiguos',
    currentFirst: 'Vigentes Primero',
    closedFirst: 'Cerradas Primero',

    // ── Ticker Names ──────────────────────────────────────────────────────────
    tickerNames: 'Tickers Info',
    addTickerName: 'Agregar Datos',
    noTickerNames: 'Sin Nombres de Tickers',
    tickerSymbol: 'Símbolo Ticker',
    companyName: 'Nombre de Empresa',

    // ── Accounts Management ───────────────────────────────────────────────────
    accountsManagement: 'Cuentas',
    manageAccounts: 'Gestionar cuentas de usuario',
    addAccount: 'Agregar Cuenta',
    editAccount: 'Editar Cuenta',
    emailAddress2: 'Correo Electrónico',
    selectAccountType: 'Tipo de Cuenta',
    noAccountsConfigured: 'No hay cuentas configuradas',
    addAccountsToStart: 'Agrega cuentas Affiliate o Admin para comenzar',
    accountAddedSuccess: 'Cuenta agregada exitosamente',
    accountUpdatedSuccess: 'Cuenta actualizada exitosamente',
    accountDeletedSuccess: 'Cuenta eliminada exitosamente',
    confirmDeleteAccount2: 'Eliminar cuenta de',
    confirmDeleteAccountMsg: 'Esto cambiará al usuario a una cuenta gratuita.',
    batchImportAccounts: 'Importar cuentas en lote',
    exportAccounts: 'Exportar lista de cuentas',
    importResultsTitle: 'Resultados de Importación',

    // ── Extras ────────────────────────────────────────────────────────────────
    extras: 'Extras',
    resourcesAndContact: 'Recursos adicionales',
    downloadOnPlayStore: 'Descargala desde la Play Store',
    balanzInt: 'Balanz Internacional',
    rdsInversionesSub: 'Visitá nuestro Sitio Web',
    balanzSub: 'Invertí con Balanz',
    invertirOnlineSub: 'Invertí con InvertirOnline',
    instagramSub: 'Visitá nuestro Instagram',
    youTubeSub: 'Visitá nuestro Canal',

    // ── Profile ───────────────────────────────────────────────────────────────
    profile: 'Perfil',
    accountSettings: 'Configuración de cuenta',
    account: 'Cuenta',
    accountType: 'Tipo de Cuenta',
    preferences: 'Preferencias',
    appLanguage: 'Idioma de la App',
    changeLanguage: 'Cambiar Idioma',
    logout: 'Cerrar Sesión',
    deleteAccount: 'Eliminar Cuenta',
    deleteAccountWarning:
      'Esta acción es permanente y no se puede deshacer. Todos tus datos serán eliminados. Se enviará un código de verificación a tu correo electrónico para confirmar.',
    sendVerificationCode: 'Enviar Código de Verificación',
    verifyToDelete: 'Verificar Identidad',
    deleteAccountOtpSent: 'Se ha enviado un código de verificación a',
    deleteAccountOtpResent: 'Se ha enviado un nuevo código de verificación a tu correo.',
    deleteAccountConfirm: 'Confirmar y Eliminar Cuenta',
    enterCode: 'Ingresa el código',
    resendCode: 'Reenviar Código',

    // ── Notifications ─────────────────────────────────────────────────────────
    notifications: 'Notificaciones',
    notificationsSubtitle: 'Recibir notificaciones push para alertas',
    notificationsEnabled: 'Notificaciones Push',
    notificationsEnabledDesc: 'Recibe notificaciones cuando se crean, actualizan o cierran alertas',
    emailNotificationsEnabled: 'Notificaciones por Email',
    emailNotificationsEnabledDesc:
      'Recibe correos cuando se crean, actualizan o cierran alertas',

    // ── Risk Profile ──────────────────────────────────────────────────────────
    riskProfile: 'Perfil de Riesgo',
    riskProfileTitle: 'Cuestionario de Perfil de Inversor',
    riskProfileSubtitle: 'Ayúdanos a entender tus objetivos de inversión',
    riskProfileQuestion1: 'Creo que necesitaré usar una gran parte de mi inversión:',
    riskProfileQuestion2: 'Me gustaría que el valor de esta inversión:',
    riskProfileQuestion3: 'En los próximos años, estoy convencido de que mi capacidad de ahorro:',
    riskProfileQuestion4: 'Considero que mi nivel de conocimiento de inversiones es:',
    riskProfileQuestion5: 'Edad actual',
    riskProfileQuestion6: 'Si el valor de mi inversión comienza a caer:',
    riskProfileQuestion7: 'El objetivo principal de esta inversión es:',
    riskProfileQuestion8:
      'Con respecto a mis activos totales (inmuebles, ahorros y acciones de empresas), esta inversión representa un porcentaje:',
    riskProfileQ1A: 'En un (1) año o menos',
    riskProfileQ1B: 'Dentro de 1 a 5 años',
    riskProfileQ1C: 'En más de 5 años',
    riskProfileQ2A: 'Sea seguro y nunca disminuya, aunque no se multiplique tanto',
    riskProfileQ2B:
      'Obtener rendimientos relativamente constantes, aunque pueda disminuir temporalmente',
    riskProfileQ2C: 'Crecer significativamente independientemente de los riesgos',
    riskProfileQ3A: 'Disminuirá',
    riskProfileQ3B: 'No variará significativamente',
    riskProfileQ3C: 'Aumentará',
    riskProfileQ4A: 'Bajo (tengo experiencia de inversión limitada)',
    riskProfileQ4B:
      'Medio (tengo algo de experiencia pero me gustaría recibir orientación y asesoramiento según sea necesario)',
    riskProfileQ4C:
      'Alto (me siento seguro para tomar decisiones de inversión y soy capaz de entender y sopesar los riesgos asociados)',
    riskProfileQ5A: 'Más de 50 años',
    riskProfileQ5B: 'Entre 35 y 50 años',
    riskProfileQ5C: 'Menos de 35 años',
    riskProfileQ6A: 'Vendo para evitar más pérdidas',
    riskProfileQ6B: 'No hago nada y necesitaría consultar a un especialista',
    riskProfileQ6C: 'Busco recursos para invertir más; las oportunidades están en las crisis',
    riskProfileQ7A: 'Tener ahorros en caso de tiempos difíciles',
    riskProfileQ7B:
      'Lograr un objetivo que me he propuesto y que creo que puedo alcanzar en 3 a 5 años',
    riskProfileQ7C: 'Mantener mi nivel de vida cuando ya no trabaje',
    riskProfileQ8A: 'Mayor al 60%',
    riskProfileQ8B: 'Entre el 30% y el 60%',
    riskProfileQ8C: 'Menos del 30%',
    riskProfileResult: 'Tu Perfil de Riesgo',
    riskProfileConservativeName: 'Conservador',
    riskProfileModerateName: 'Moderado',
    riskProfileAggressiveName: 'Agresivo',
    riskProfileConservativeDesc:
      'Valoro la seguridad y busco preservar el valor inicial de mi inversión, independientemente de si la rentabilidad percibida es muy alta.\n\nPerfil de Riesgo de Fondos de Inversión Propuestos: Medio-bajo, Bajo',
    riskProfileModerateDesc:
      'Deseo la apreciación del capital invertido, aunque las fluctuaciones del mercado puedan causar una pérdida moderada. Me esfuerzo por mantener un equilibrio entre rentabilidad y seguridad.\n\nPerfil de Riesgo de Fondos de Inversión Propuestos: Medio-alto, Medio, Medio-bajo, Bajo',
    riskProfileAggressiveDesc:
      'Espero altos rendimientos, aunque esto pueda implicar altas fluctuaciones y la posible pérdida de un porcentaje significativo del monto invertido.\n\nPerfil de Riesgo de Fondos de Inversión Propuestos: Alto, Medio-alto, Medio, Medio-bajo, Bajo',
    riskProfileUnderstood: 'Entendido',
    riskProfileRetake: 'Actualizar',
    riskProfileUpdateBtn: 'Actualizar',
    riskProfileNotSet: 'Aún no determinado',
    riskProfileProgress: 'Pregunta {current} de {total}',
    riskProfileNext: 'Siguiente',
    riskProfileSubmit: 'Enviar',
    riskProfilePrev: 'Anterior',

    // ── Conditions (legacy) ───────────────────────────────────────────────────
    bullish: 'Alcista',
    neutral: 'Neutral',
    bearish: 'Bajista',

    // ── Terms and Conditions ──────────────────────────────────────────────────
    termsAndConditions: 'Términos y Condiciones',
    acceptTerms: 'Acepto',
    declineTerms: 'Rechazar',
    mustAcceptTerms: 'Debes aceptar los Términos y Condiciones para continuar',
    viewTermsAndConditions: 'Ver Términos y Condiciones',
    scrollToAccept: 'Desplázate hasta el final para aceptar',
    pleaseReadCarefully: 'Por favor lee atentamente antes de continuar',
    termsUpdatedTitle: 'Términos Actualizados',
    termsUpdatedMessage:
      'Nuestros Términos y Condiciones han sido actualizados. Por favor revisa y acepta la nueva versión para continuar.',
    termsVersion: 'Versión',
    termsContent: `**Última Actualización:** 06/05/2026

**1. Aceptación de los Términos y Condiciones**

Al descargar, acceder o utilizar esta aplicación, usted acepta quedar sujeto a estos Términos y Condiciones y a esta Política de Privacidad.

Si no está de acuerdo, no debe utilizar la App.

**2. Descripción del Servicio**

La App proporciona:
• Calificaciones de tendencia para instrumentos financieros (por ejemplo, acciones, ETFs e índices)
• Contenido financiero educativo e informativo

La App se ofrece de forma gratuita y puede evolucionar con el tiempo.

**3. Ausencia de Asesoramiento Financiero**

Todo el contenido proporcionado a través de la App tiene únicamente fines informativos y educativos y no constituye asesoramiento financiero, de inversión, legal ni fiscal.

La App no tiene en cuenta su situación financiera, objetivos ni tolerancia al riesgo, y no existe ninguna relación fiduciaria entre usted y el proveedor de la App.

**4. Divulgación de Riesgos de Inversión**

Invertir en los mercados financieros implica riesgos significativos, incluyendo pérdida de capital, volatilidad del mercado, riesgos de liquidez e imprecisiones de los modelos utilizados.

Las calificaciones de la App se basan en modelos y supuestos de análisis técnico, los cuales pueden ser incorrectos, incompletos o estar desactualizados, y no garantizan resultados futuros.

Los resultados pasados no son indicativos de resultados futuros.

Usted es el único responsable de sus decisiones de inversión y de cualquier resultado financiero derivado del uso de la App.

**5. Limitación de Responsabilidad**

En la máxima medida permitida por la ley, el proveedor de la App no será responsable por pérdidas financieras, pérdidas de operaciones, lucro cesante, interrupciones del servicio, inexactitudes en los datos ni daños indirectos.

**6. Ausencia de Garantías**

La App se proporciona "tal cual" y "según disponibilidad", sin garantías de ningún tipo, incluyendo exactitud, confiabilidad, aptitud para un propósito particular o funcionamiento ininterrumpido.

**7. Responsabilidades del Usuario**

Usted acepta no depender exclusivamente de la App para tomar decisiones de inversión, realizar su propia investigación o consultar a profesionales, y cumplir con las regulaciones financieras aplicables.

**8. Datos y Servicios de Terceros**

La App puede utilizar servicios de terceros para datos de mercado y análisis. El proveedor no garantiza la exactitud o integridad de dichos datos y no es responsable por interrupciones o errores de servicios de terceros.

**9. Propiedad Intelectual**

Todos los algoritmos, metodologías de calificación, diseños e interfaces son propiedad del proveedor de la App y no pueden ser copiados, reproducidos, distribuidos ni sometidos a ingeniería inversa.

**10. Modificaciones y Terminación**

El proveedor puede modificar la App o estos Términos en cualquier momento y puede suspender o terminar el acceso sin previo aviso. El uso continuado constituye aceptación de dichos cambios.

**POLÍTICA DE PRIVACIDAD**

**11. Responsable del Tratamiento de Datos**

El proveedor de la App es el responsable del tratamiento de sus datos personales.

Contacto: theappswarehouse@gmail.com

**12. Datos Recopilados**

La App puede recopilar:
• Dirección de correo electrónico (cuando corresponda)
• Datos del dispositivo y de uso
• Datos analíticos y de rendimiento

**13. Uso de los Datos**

Los datos se utilizan para operar las funciones de la App, analizar el uso y el rendimiento, comunicar actualizaciones importantes, gestionar cuentas y mejorar la seguridad.

**14. Seguimiento y Analítica**

La App puede utilizar herramientas de análisis y reporte de fallos, incluyendo Google Analytics, Firebase Analytics o tecnologías similares. Estas herramientas pueden recopilar información anonimizada sobre el uso de la App.

**15. Compartición de Datos**

Sus datos no se venden. Podrán compartirse con proveedores de servicios o autoridades legales cuando la ley así lo requiera.

**16. Transferencias Internacionales de Datos**

Los datos pueden ser procesados fuera de su país con las salvaguardas adecuadas y de conformidad con la normativa aplicable.

**17. Conservación de los Datos**

Los datos se conservan únicamente durante el tiempo necesario para prestar los servicios y cumplir con las obligaciones legales.

**18. Sus Derechos**

Dependiendo de su jurisdicción, usted puede tener derecho a acceder, rectificar, eliminar, oponerse al tratamiento y retirar su consentimiento respecto de sus datos personales.

De acuerdo con la Ley Argentina 25.326, usted puede acceder gratuitamente a sus datos personales en intervalos no inferiores a seis meses.

**19. Seguridad de los Datos**

Se aplican medidas técnicas y organizativas razonables para proteger los datos personales; sin embargo, ningún sistema es completamente seguro.

**20. Privacidad de los Menores**

La App no está destinada a usuarios menores de 18 años y no recopila conscientemente datos de menores.

**21. Cumplimiento con Google Play**

La App cumple con las Políticas para Desarrolladores de Google Play, los requisitos de seguridad de datos y las obligaciones de transparencia en el tratamiento de datos de los usuarios.

**22. Cambios en la Política de Privacidad**

Esta Política de Privacidad puede actualizarse periódicamente. El uso continuado implica la aceptación de cualquier cambio.

**Contacto:** theappswarehouse@gmail.com`,
  },
} as const;

/** Convenience type — the union of every valid translation key */
export type TranslationKey = keyof typeof translations.en;
