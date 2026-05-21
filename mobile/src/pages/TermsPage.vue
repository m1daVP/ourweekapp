<template>
  <section class="page-stack legal-page">
    <header>
      <p class="page-kicker">Terms</p>
      <h1>Weekly Us terms</h1>
      <p class="page-copy">
        Placeholder for internal testing. Replace this with reviewed terms
        before any public Google Play release.
      </p>
    </header>

    <section class="content-panel">
      <h2>Internal testing only</h2>
      <p>
        This build is prepared for internal testing. It is not ready for public
        distribution, paid subscriptions, backend sync, or production support.
      </p>
    </section>

    <section class="content-panel">
      <h2>Not professional advice</h2>
      <p>
        Weekly Us is a practical household check-in tool. It is not therapy,
        legal advice, financial advice, or emergency support.
      </p>
    </section>

    <section class="content-panel">
      <h2>Local data responsibility</h2>
      <p>
        Data is stored locally on this device in the current MVP. Users should
        review important agreements before relying on them and understand that
        uninstalling the app or clearing app storage may remove local data.
      </p>
    </section>

    <RouterLink class="secondary-button link-button" :to="{ name: 'settings' }">
      Back to settings
    </RouterLink>
  </section>
</template>
