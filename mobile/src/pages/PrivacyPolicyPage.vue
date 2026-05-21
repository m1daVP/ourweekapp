<template>
  <section class="page-stack legal-page">
    <header>
      <p class="page-kicker">Privacy Policy</p>
      <h1>Weekly Us privacy</h1>
      <p class="page-copy">
        Placeholder for internal testing. Replace this with a reviewed policy
        before any public Google Play release.
      </p>
    </header>

    <section class="content-panel">
      <h2>Current MVP data model</h2>
      <p>
        Weekly Us stores meeting notes, tasks, agreements, participants, private
        notes, settings, and mock Premium state locally on this device. No
        backend sync is connected in the current MVP.
      </p>
    </section>

    <section class="content-panel">
      <h2>Private notes</h2>
      <p>
        Private notes are stored on this device in the current MVP. They are not
        included in meeting exports by default.
      </p>
    </section>

    <section class="content-panel">
      <h2>AI and Premium placeholders</h2>
      <p>
        AI summaries use a local mock provider unless a backend API is
        explicitly enabled. AI summaries may be inaccurate. Review before
        relying on them.
      </p>
      <p>
        Premium and billing screens use mock subscription state for internal
        testing only. Real payments are not connected.
      </p>
    </section>

    <RouterLink class="secondary-button link-button" :to="{ name: 'settings' }">
      Back to settings
    </RouterLink>
  </section>
</template>
