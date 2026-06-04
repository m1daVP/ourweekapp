export const messages = {
  en: {
    app: {
      name: 'Weekly Us',
      navigationLabel: 'Primary navigation',
      openSettings: 'Open settings',
      householdMembers: 'Household members',
      storageAttention: 'Some saved data needs attention',
      dismiss: 'Dismiss',
      routeTitles: {
        home: 'Weekly Us',
        meeting: 'Weekly Ritual',
        meetingTemplates: 'Choose a Template',
        tasks: 'Household Tasks',
        history: 'History',
        settings: 'Settings',
        upgrade: 'Premium',
        privateNotes: 'Private Notes',
        calendarSync: 'Calendar Sync',
        workspaceSettings: 'Household',
        account: 'Account',
        meetingDetails: 'Meeting Summary',
        meetingSummary: 'Meeting Summary',
      },
      nav: {
        home: 'Home',
        meeting: 'Meeting',
        tasks: 'Tasks',
        history: 'History',
        settings: 'Settings',
      },
    },
    common: {
      add: 'Add',
      available: 'Available',
      back: 'Back',
      close: 'Close',
      copy: 'Copy',
      dismiss: 'Dismiss',
      done: 'Done',
      draft: 'Draft',
      due: 'Due',
      enable: 'Enable',
      exit: 'Exit',
      export: 'Export',
      finish: 'Finish',
      finished: 'Finished',
      locked: 'Locked',
      markdown: 'Markdown',
      next: 'Next',
      noneRecorded: 'None recorded.',
      open: 'Open',
      pdf: 'PDF',
      remove: 'Remove',
      resume: 'Resume',
      save: 'Save',
      shareOrSave: 'Share or save',
      skipped: 'Skipped',
      status: 'Status',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      email: 'Email',
      password: 'Password',
      displayName: 'Display name',
      free: 'Free',
      notAvailable: 'Not available',
      restorePurchases: 'Restore purchases',
      manageSubscription: 'Manage subscription',
      goBack: 'Go back',
      localUser: 'Local user',
      weeklyUsUser: 'Weekly Us user',
    },
    localization: {
      title: 'Language',
      description:
        'Choose the language for app controls and system text on this device.',
      label: 'App language',
    },
    account: {
      kicker: 'Account',
      title: 'Account settings',
      intro:
        'Manage the frontend account model used for sync, premium access, and future family workspace features.',
      signedInAs: 'Signed in as',
      plan: 'Plan',
      created: 'Created',
      subscription: 'Subscription',
      currentPlan:
        'Current plan: {plan}. Premium access is based on the subscription entitlement, not account state alone.',
      renewal: 'Renewal',
      renewalUnavailable: 'Not available until real mobile billing is added.',
      manageSubscription: 'Manage subscription',
      manageAvailable: 'Available through the store.',
      manageUnavailable: 'Placeholder only. No payment provider is connected.',
      viewPremium: 'View Premium',
      restorePurchases: 'Restore purchases',
      profile: 'Profile',
      profileHelp: 'Only display name editing is local in this MVP.',
      saveAccount: 'Save account',
      session: 'Session',
      mockSession:
        'Mock auth is active. The access token is a placeholder and no real password is stored locally.',
      apiSession:
        'Signed-in requests should use the stored access token through the API layer.',
      logOut: 'Log out',
      addDisplayName: 'Add a display name.',
      updateFailed: 'Could not update the account.',
      updated: 'Account updated on this device.',
    },
    auth: {
      signInKicker: 'Sign in',
      welcomeBack: 'Welcome Back',
      signInIntro:
        'Continue your weekly household rhythm and pick up where you left off.',
      forgotPassword: 'Forgot password?',
      mockSignIn:
        'Mock auth is active. Any email and password will create a temporary frontend session.',
      signingIn: 'Signing in...',
      signIn: 'Sign in',
      newHere: 'New to Weekly Us?',
      createAccount: 'Create account',
      createAccountIntro:
        'Set up a calm shared place for weekly check-ins, agreements, and household follow-up.',
      yourName: 'Your name',
      passwordHelp: 'At least 8 characters',
      mockSignUp:
        'Mock auth is active. The password is sent through the mock auth service and is not saved locally.',
      creating: 'Creating...',
      alreadyHaveAccount: 'Already have an account?',
      passwordHelpKicker: 'Password help',
      resetPasswordTitle: 'Reset password placeholder.',
      resetPasswordIntro:
        'Backend email is not connected yet. This screen keeps the account flow ready without pretending a reset was sent.',
      resetPlaceholder:
        'Password reset is a placeholder until backend email is connected.',
      remembered: 'Remembered it?',
      addAccountEmail: 'Add the email for your account.',
      addEmail: 'Add an email address.',
      addPassword: 'Add your password.',
      passwordLength: 'Use at least 8 characters for the password.',
      signInFailed: 'Could not sign in.',
      signUpFailed: 'Could not create the account.',
      continue: 'Continue',
      emailPlaceholder: "you{'@'}example.com",
    },
    welcome: {
      tagline: 'A calmer way to plan the week together',
      intro:
        'A guided 15-minute weekly meeting for shared tasks, practical agreements, and fewer repeated household conversations.',
      benefitsLabel: 'Why create an account',
      syncLater: 'Sync later',
      syncLaterText:
        'Prepare for cross-device access when backend sync is connected.',
      keepHistory: 'Keep history',
      keepHistoryText:
        'Connect meetings, agreements, and unfinished follow-ups to you.',
      premiumReady: 'Premium ready',
      premiumReadyText:
        'Use the same account model for paid features when payments are added.',
      mockAuth:
        'Account sign-in is mocked in this build. No real password is stored locally.',
      getStarted: 'Get Started',
      continueLocal: 'Continue on this device only',
    },
    logout: {
      kicker: 'Log out',
      title: 'Log out of Weekly Us?',
      accountFallback: 'this account',
      intro:
        'You will leave {email} on this device. Local meeting data already saved on this phone is not deleted.',
      help: 'You can continue local-only after logging out, or sign back in from the welcome screen.',
      loggingOut: 'Logging out...',
      keepSignedIn: 'Keep signed in',
    },
    home: {
      greeting: 'Good morning,<br>{name}.',
      greetingPrefix: 'Good morning,',
      householdFallback: 'your household',
      heroTitle: 'Ready for your 15-minute weekly reset?',
      heroText:
        'Take a moment to align on the week ahead, celebrate wins, and connect.',
      startMeeting: 'Start Meeting',
      shortcutsLabel: 'Weekly Us shortcuts',
      tasksToReview: '{count} tasks to review',
      fromCheckIns: 'From weekly check-ins',
      meetingsSaved: '{count} meetings saved',
      fullHistory: 'Full history available',
      freeLatest: 'Free opens latest {count}',
      unlockHistory: 'Unlock full history',
      unlockHistoryMessage:
        'Look back at older weekly check-ins and agreements when your household needs context.',
    },
    history: {
      kicker: 'Meeting history',
      title: 'Past check-ins',
      intro:
        'Finished meetings stay saved locally. Free history opens the latest {count} finished meetings.',
      inProgress: 'In Progress',
      completedMeetings: 'Completed Meetings',
      defaultMeetingTitle: 'Weekly family check-in',
      draftedToday: 'Drafted today',
      draftedYesterday: 'Drafted yesterday',
      draftedDaysAgo: 'Drafted {count} days ago',
      completedOn: 'Completed on {day}',
      noDrafts: 'No meeting in progress.',
      unlockFullHistory: 'Unlock full history',
      unlockFullHistoryMessage:
        "Looking back helps you see how far you've come together. Upgrade to Weekly Us Premium to view all past check-ins.",
      upgradePremium: 'Upgrade Premium',
      privateNotes: 'Private notes',
      privateNotesText:
        'Keep personal notes separate from shared meeting history.',
      counts: '{notes} notes - {tasks} tasks - {agreements} agreements',
      deleteDraft: 'Delete draft',
      confirmDeleteDraft:
        'Delete this draft? Notes, tasks, and agreements from it will be removed.',
      draftDeleted: 'Draft deleted.',
      lockedTitle: 'Older meeting locked',
      lockedMessage:
        'Free history opens the latest {count} finished meetings. Upgrade to review this meeting.',
      emptyTitle: 'No meetings yet',
      emptyText: 'Draft and finished meetings will appear here.',
    },
    meetingSummary: {
      title: 'Meeting Summary',
      mockTitle: 'Weekly family check-in',
      mockDate: 'Oct 15, 2023',
      mockAiInsight:
        'A productive session focused on balancing the upcoming busy school week. Mood was collaborative and supportive, with everyone agreeing on a solid plan for shared responsibilities.',
      mockDecisionScreenTime:
        'Agreed to limit screen time to 1 hour on weeknights for everyone.',
      mockDecisionGroceries:
        'Sarah will handle grocery shopping this Wednesday evening.',
      mockDecisionHiking:
        'Next weekend is dedicated to family hiking at the state park.',
      mockActionFaucet: 'Fix the leaky faucet in guest bathroom',
      mockActionSoccer: 'Register for fall soccer league',
      aiInsight: 'AI Insight',
      aiDisclaimer:
        'AI summaries may be inaccurate. Review before relying on them.',
      aiGenerating: 'Preparing the AI insight...',
      aiLocked:
        'AI insight is available with Premium. The saved decisions and action items are still shown below.',
      aiUpgrade: 'Review Premium',
      aiFailed:
        'The AI insight could not be prepared right now. The saved decisions and action items are still shown below.',
      aiEmpty:
        'No AI insight is saved for this meeting yet. The saved decisions and action items are still shown below.',
      keyDecisions: 'Key Decisions',
      noDecisions: 'No decisions were recorded in this meeting.',
      actionItems: 'Action Items',
      noActions: 'No action items were recorded in this meeting.',
      viewFullNotes: 'View full notes',
      sentiment: 'Sentiment',
      overallMood: 'Overall Mood',
      positiveAligned: 'Positive & Aligned',
      sentimentStrength: 'Mood strength',
      shareSummary: 'Share Summary',
      copied: 'Summary copied.',
      shared: 'Summary shared.',
      saved: 'Summary saved as a file.',
      shareFailed: 'Could not share this summary right now.',
    },
    workspace: {
      title: 'Household Members',
      intro: 'Manage who has access to your shared space.',
      currentMembersLabel: 'Current members',
      member: 'Member',
      viewer: 'Viewer',
      admin: 'Admin',
      removeMember: 'Remove member',
      pendingInvites: 'Pending Invites',
      savedLocally: 'Saved locally',
      resend: 'Resend',
      inviteKept: 'Invite kept locally.',
      inviteNewMember: 'Invite New Member',
      closeInviteForm: 'Close invite form',
      goBack: 'Go back',
      addMember: 'Add Member',
      contact: 'Email or Phone Number',
      contactPlaceholder: 'Enter email or phone number',
      role: 'Role',
      inviteHelp:
        "Invited members will receive a link to join your household's weekly ritual once backend invitations are connected.",
      sendInvitation: 'Send Invitation',
      ownerInviteOnly: 'Only the owner can invite members.',
      addContactFirst: 'Add an email or phone number first.',
      saveInviteFailed: 'Could not save this invite.',
      invitationSaved:
        'Invitation saved locally. No email has been sent in this MVP.',
      ownerRemoveOnly: 'Only the owner can remove members.',
      memberRemoved: 'Member removed from the workspace.',
    },
    privateNotes: {
      kicker: 'Private notes',
      title: 'Personal reflections',
      intro:
        'Keep personal thoughts separate from shared meeting notes, tasks, and agreements.',
      storageLabel: 'Private notes storage note',
      reflectionTitle: 'For your own reflection',
      storageText:
        'Private notes are stored on this device in the current MVP.',
      premiumTitle: 'Private notes are premium',
      premiumMessage:
        'Upgrade to keep personal meeting prep and reflections separate from shared household records.',
      editTitle: 'Edit private note',
      createTitle: 'Create private note',
      editorHelp:
        'These notes stay out of shared meeting summaries and agreements.',
      titleLabel: 'Title',
      titlePlaceholder: 'What is this about?',
      noteLabel: 'Note',
      notePlaceholder: 'Write what you want to remember for yourself.',
      relatedMeeting: 'Related meeting',
      noMeetingLink: 'No meeting link',
      saveChanges: 'Save changes',
      saveNote: 'Save note',
      savedTitle: 'Saved private notes',
      notesCount: '{count} personal notes on this device.',
      linkedTo: 'Linked to {meeting}',
      noNotes: 'No private notes yet. Add one before or after a meeting.',
      addTitleAndNote: 'Add a title and note before saving.',
      noteUpdated: 'Private note updated.',
      noteSaved: 'Private note saved.',
      confirmDelete: 'Delete this private note?',
      noteDeleted: 'Private note deleted.',
    },
    templatePage: {
      kicker: 'Meeting templates',
      title: 'Choose a Template',
      intro: 'Start with a focused structure for your next check-in.',
      continueDraft: 'Continue current meeting',
      sectionsLabel: 'Meeting sections',
      upgradeToUse: 'Upgrade to use',
      getPremium: 'Get Premium',
      startMeeting: 'Start Meeting',
    },
    calendar: {
      kicker: 'Calendar sync',
      title: 'Google Calendar',
      intro:
        'Prepare weekly meetings, task due dates, and follow-ups for calendar sync.',
      placeholderTitle: 'Connection placeholder',
      placeholderText:
        'Google OAuth and token handling should be backend-supported or use a secure recommended flow before real sync is enabled.',
      premiumTitle: 'Google Calendar sync is premium',
      premiumMessage:
        'Upgrade to prepare Weekly Us meetings, task due dates, and follow-ups for Google Calendar.',
      connectionTitle: 'Google Calendar connection',
      checkingConnection: 'Checking Google Calendar connection.',
      notConnected: 'Google Calendar is not connected.',
      preparingConnection: 'Preparing connection',
      connect: 'Connect Google Calendar',
      disconnect: 'Disconnect',
      noTokens: 'No Google tokens are stored in this mobile app.',
      optionsTitle: 'Sync options',
      optionsText:
        'Choose what Weekly Us should sync once Google Calendar is ready.',
      options: {
        weeklyMeeting: {
          label: 'Add weekly meeting reminder to calendar',
          description: 'Create one calendar event for the household check-in.',
        },
        taskDueDates: {
          label: 'Add task due dates to calendar',
          description: 'Use due dates from tasks that need a clear follow-up.',
        },
        followUpDates: {
          label: 'Add follow-up dates to calendar',
          description: 'Keep agreed revisit dates visible between meetings.',
        },
      },
      setupRequired:
        'Google Calendar connection is prepared, but secure OAuth is not configured yet.',
      addMeetingDate: 'Add a meeting date before syncing a calendar reminder.',
      addTaskDueDate:
        'Add a task due date before syncing it to Google Calendar.',
      addFollowUpDate:
        'Add a follow-up date before syncing it to Google Calendar.',
      oauthWaiting:
        'Calendar sync is waiting for a secure Google connection flow.',
      checkFailed: 'Something went wrong while checking Calendar sync.',
      startFailed: 'Something went wrong while starting Calendar sync.',
      disconnectFailed:
        'Something went wrong while disconnecting Calendar sync.',
    },
    upgrade: {
      kicker: 'Premium',
      title: 'Upgrade Weekly Us',
      intro:
        'Premium is for households that want a longer memory, gentle follow-up, and clean summaries after each weekly check-in.',
      heroTitle: 'Keep the weekly ritual easier to revisit',
      heroText:
        'Unlock practical additions without changing Weekly Us into a task tracker or a budgeting app.',
      placeholdersTitle: 'Plan placeholders',
      placeholdersText:
        'Prices and billing will be connected later through the proper mobile subscription flow.',
      planOptionsLabel: 'Premium plan options',
      premiumActive: 'Premium active',
      startMockPremium: 'Start mock Premium',
      billingNote:
        'This paywall uses a mock billing provider only. Real mobile billing must validate entitlements through a trusted provider or backend before unlocking Premium in production.',
      comparisonTitle: 'Plan comparison',
      comparisonText:
        'No pressure. Free keeps the core weekly meeting flow available.',
      statusTitle: 'Subscription status',
      currentPlan: 'Current plan: {plan}',
      renewal: 'Renewal',
      manageSubscription: 'Manage subscription',
      account: 'Account',
      renewalUnavailable: 'Not available until real billing is connected.',
      manageAvailable: 'Available through the store.',
      manageUnavailable: 'Mobile billing management will be added later.',
      localDeviceMode: 'Local device mode',
      storeBillingNotConnected: 'Store billing is not connected in this build.',
      mockPurchasesDisabled:
        'Mock purchases are disabled in production builds.',
      planUnavailable: 'This Premium plan is not available.',
      mockPremiumEnabled: 'Mock Premium is enabled on this device.',
      mockPremiumRestored: 'Mock Premium was restored on this device.',
      noMockPremium: 'No mock Premium purchase was found on this device.',
      managementLater:
        'Subscription management will open Google Play or App Store settings after real billing is configured.',
      checkFailed: 'Something went wrong while checking Premium access.',
      startFailed: 'Something went wrong while starting Premium.',
      restoreFailed: 'Something went wrong while restoring purchases.',
      manageFailed:
        'Something went wrong while opening subscription management.',
      plans: {
        premiumMonthly: {
          name: 'Monthly',
          priceLabel: 'Price pending',
          description: 'A flexible Premium option for the mock paywall.',
        },
        premiumYearly: {
          name: 'Yearly',
          priceLabel: 'Price pending',
          description: 'A yearly Premium option for the mock paywall.',
        },
      },
    },
    settings: {
      kicker: 'Settings',
      title: 'Household setup',
      intro:
        'Manage the local people list used for notes, tasks, and agreements.',
      account: 'Account',
      signedInAs: 'Signed in as {email}.',
      signedInFallback: 'your account',
      localOnly: 'Using Weekly Us on this device only.',
      noAccount: 'No account connected yet.',
      accountSettings: 'Account settings',
      accountOptions: 'Account options',
      workspaceSettings: 'Workspace settings',
      calendarSync: 'Calendar sync',
      legal: 'Legal',
      legalText:
        'Placeholder documents for internal testing. Review before public release.',
      privacyPolicy: 'Privacy Policy',
      terms: 'Terms',
      reminders: 'Reminders',
      reminderPremiumTitle: 'Reminder settings are premium',
      reminderPremiumMessage:
        'Upgrade to schedule gentle local reminders for weekly meetings and unfinished household follow-ups.',
      reminderIntro:
        'Weekly Us can use local device notifications for your meeting and unfinished follow-ups. No push notifications or account setup are used.',
      enableReminders: 'Enable reminders',
      weeklyMeetingReminder: 'Weekly meeting reminder',
      unfinishedTaskReminder: 'Unfinished task reminder',
      day: 'Day',
      time: 'Time',
      reminderExample:
        'Example: A gentle reminder to review unfinished agreements.',
      reminderLocked: 'Reminder settings are available with Premium.',
      remindersOff: 'Reminders are off.',
      notificationsUnavailable:
        'Local notifications are available in the Android app. Web dev mode keeps these settings without scheduling notifications.',
      notificationsBlocked: 'Notifications are blocked in system settings.',
      remindersScheduled: 'Reminders are scheduled on this device.',
      remindersSaved:
        'Reminders are saved and will be scheduled when notifications are available.',
      participants: 'Participants',
      participantsIntro:
        'Stored on this device for now. No accounts or invitations yet.',
      name: 'Name',
      initials: 'Initials',
      auto: 'Auto',
      type: 'Type',
      avatarColor: 'Avatar color',
      color: 'Color',
      addParticipant: 'Add participant',
      participantAdded: 'Participant added.',
      participantUpdated: 'Participant updated.',
      participantEnabled: 'Participant enabled.',
      participantDisabled:
        'Participant disabled. Existing records still keep their name.',
      participantRemoved: 'Unused participant removed.',
      addNameFirst: 'Add a name first.',
      disable: 'Disable',
      mockWorkspaceRole: 'Mock workspace role',
      premiumFeatureChecks: 'Premium feature checks',
      role: {
        owner: 'Owner',
        adultMember: 'Adult member',
        viewer: 'Viewer',
      },
      defaultParticipant: {
        me: 'Me',
        partner: 'Partner',
      },
      defaultWorkspace: 'Our weekly space',
      participantType: {
        adult: 'Adult',
        child: 'Child',
        other: 'Other',
      },
    },
    tasksPage: {
      kicker: 'Tasks',
      title: 'What we agreed to do',
      intro:
        'A light place for household follow-ups from your weekly meetings.',
      openTasks: 'Open tasks',
      stillRelevantCount: '{count} still relevant',
      readOnlyTasks: 'This workspace role can view tasks but cannot edit them.',
      task: 'Task',
      responsible: 'Responsible',
      needsDiscussion: 'Needs discussion',
      shared: 'Shared',
      disabledParticipant: ' (disabled)',
      stillRelevant: 'Still relevant?',
      fromMeeting: 'From {meeting}',
      skip: 'Skip',
      doneTasks: 'Done tasks ({count})',
      skippedTasks: 'Skipped tasks ({count})',
      reopen: 'Reopen',
      bringBack: 'Bring back',
      noOpenTasks: 'No open tasks right now.',
      nothingDone: 'Nothing marked done yet.',
      noSkippedTasks: 'No skipped tasks.',
      recentAgreements: 'Recent agreements',
      agreementsIntro: 'Decisions saved from weekly meetings.',
      noAgreements: 'No agreements saved yet.',
      agreement: 'Agreement',
      date: 'Date',
      meeting: 'Meeting',
      people: 'People',
      relatedTasks: 'Related tasks',
      addShortTitle: 'Add a short title first.',
      taskUpdated: 'Task updated.',
      markedDone: 'Marked done.',
      updated: 'Updated.',
      ownerDeleteOnly: 'Only the owner can delete tasks.',
      confirmDeleteTask: 'Delete this task?',
      taskDeleted: 'Task deleted.',
    },
    legal: {
      backToSettings: 'Back to settings',
      privacy: {
        kicker: 'Privacy Policy',
        title: 'Weekly Us privacy',
        intro:
          'Placeholder for internal testing. Replace this with a reviewed policy before any public Google Play release.',
        dataTitle: 'Current MVP data model',
        dataText:
          'Weekly Us stores meeting notes, tasks, agreements, participants, private notes, settings, and mock Premium state locally on this device. No backend sync is connected in the current MVP.',
        privateNotesTitle: 'Private notes',
        privateNotesText:
          'Private notes are stored on this device in the current MVP. They are not included in meeting exports by default.',
        aiTitle: 'AI and Premium placeholders',
        aiText:
          'AI summaries use a local mock provider unless a backend API is explicitly enabled. AI summaries may be inaccurate. Review before relying on them.',
        premiumText:
          'Premium and billing screens use mock subscription state for internal testing only. Real payments are not connected.',
      },
      terms: {
        kicker: 'Terms',
        title: 'Weekly Us terms',
        intro:
          'Placeholder for internal testing. Replace this with reviewed terms before any public Google Play release.',
        testingTitle: 'Internal testing only',
        testingText:
          'This build is prepared for internal testing. It is not ready for public distribution, paid subscriptions, backend sync, or production support.',
        adviceTitle: 'Not professional advice',
        adviceText:
          'Weekly Us is a practical household check-in tool. It is not therapy, legal advice, financial advice, or emergency support.',
        localDataTitle: 'Local data responsibility',
        localDataText:
          'Data is stored locally on this device in the current MVP. Users should review important agreements before relying on them and understand that uninstalling the app or clearing app storage may remove local data.',
      },
    },
    days: {
      sunday: 'Sunday',
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
    },
    meeting: {
      closeMeeting: 'Close meeting',
      stepOf: 'Step {current} of {total}',
      saveDraft: 'Save draft',
      menu: {
        label: 'Ritual menu',
        open: 'Open ritual menu',
        pauseRitual: 'Pause Ritual',
        resumeRitual: 'Resume Ritual',
        saveDraftExit: 'Save Draft & Exit',
        endSession: 'End Session',
        deleteRitual: 'Delete Ritual',
      },
      notes: 'Notes',
      author: 'Author',
      note: 'Note',
      addNote: 'Add note',
      noNotesYet: 'No notes yet.',
      noNotesInSection: 'No notes in this section.',
      tasks: 'Tasks',
      taskTitle: 'Task title',
      optionalDetail: 'Optional detail',
      responsible: 'Responsible',
      dueDate: 'Due date',
      addTask: 'Add task',
      noTasksYet: 'No tasks yet.',
      noTasksInSection: 'No tasks in this section.',
      agreements: 'Agreements',
      decisionOrAgreement: 'Decision or agreement',
      participants: 'Participants',
      addAgreement: 'Add agreement',
      noAgreementsYet: 'No agreements yet.',
      noAgreementsInSection: 'No agreements in this section.',
      reviewTogether: 'Review together',
      reviewIntro:
        'Look over the notes, tasks, and agreements before finishing.',
      tasksAndResponsibilities: 'Tasks and responsibilities',
      atLeastOne: 'Add at least one note, task, or agreement before finishing.',
      finished: 'This meeting is finished.',
      newMeeting: 'New meeting',
      weeklyMeeting: 'Weekly Meeting',
      readOnlyTitle: 'Read-only access',
      readOnlyText:
        'Viewers can see shared summaries and tasks, but cannot start or edit a weekly meeting.',
      viewHistory: 'View history',
      formerParticipant: 'Former participant',
      someone: 'Someone',
      shared: 'Shared',
      needsDiscussion: 'Needs discussion',
      unassigned: 'Unassigned',
      recentMeeting: 'Recent meeting',
      fromMeeting: 'From {title} - {date}',
      unfinishedTitle: 'What should we do with unfinished tasks?',
      stillRelevant: 'Still relevant? {date}',
      unfinishedChoices: 'Unfinished task choices',
      keep: 'Keep',
      markDone: 'Mark done',
      skip: 'Skip',
      moveToThisWeek: 'Move to this week',
      noContentPreview: 'No notes, tasks, or agreements yet.',
      meetingNotFound: 'Meeting not found',
      notSaved: 'This meeting is not saved on this device.',
      backToHistory: 'Back to history',
      olderMeetingLocked: 'Older meeting locked',
      freeHistoryLimit:
        'Free history opens the latest {count} finished meetings. Upgrade to review every section, note, task, and agreement.',
      exportPremiumTitle: 'Export is premium',
      exportPremiumMessage:
        'Upgrade to export meeting summaries, agreements, and tasks.',
      exportMeeting: 'Export meeting',
      exportHelp:
        'Save a clean copy of the summary, notes, tasks, and agreements. Private notes are not included.',
      aiPremiumTitle: 'AI summaries are premium',
      aiPremiumMessage:
        'Upgrade to generate neutral meeting summaries and next steps.',
      aiSummary: 'AI summary',
      aiDisclaimer:
        'AI summaries may be inaccurate. Review before relying on them. This is not professional relationship advice.',
      generate: 'Generate',
      regenerate: 'Regenerate',
      generateSummary: '{action} summary',
      mainTopics: 'Main topics discussed',
      keyTensions: 'Key tensions',
      agreementsMade: 'Agreements made',
      openTasks: 'Open tasks',
      noOpenTasksSummarized: 'No open tasks were summarized.',
      revisitNextWeek: 'Topics to revisit next week',
      generateEmpty:
        'Generate a neutral summary of the meeting, agreements, and next steps.',
      exportChoose: 'Choose a simple format. Private notes are not included.',
      format: 'Format',
      plainText: 'Plain text',
      plainTextHelp: 'Best for copying into messages or notes.',
      markdownHelp: 'Clean headings and lists for documents.',
      copied: 'Export copied to clipboard.',
      copyFailed: 'Could not copy this export. Try sharing or saving it.',
      sharedExport: 'Export shared.',
      savedExport: 'Export saved as a file.',
      shareFailed: 'Could not share or save this export right now.',
      printOpened: 'Print view opened. Choose Save as PDF if available.',
      printFailed: 'Could not open the PDF print view on this device.',
      generateFailed: 'Could not generate a summary right now.',
      notePlaceholders: {
        goodThings: 'One thing I appreciated was...',
        tensions: 'I noticed this felt hard because...',
        tasks: 'A useful detail for this week is...',
        money: 'Something to buy or decide about money is...',
        familyCare: 'A family care note to remember is...',
        plans: 'Something coming up next week is...',
        finalAgreements: 'A decision we want to keep is...',
        default: 'Add a short practical note...',
      },
      taskTitlePlaceholder: 'What needs care?',
      taskDetailPlaceholder: 'Anything that would make this easier?',
      agreementPlaceholder: 'What did we agree to?',
      neutralHint:
        'Try naming what happened and what would help, without labels or blame.',
      roleCannotEditMeetings:
        'This workspace role can view meetings but cannot edit.',
      roleCannotEditTasks:
        'This workspace role can view tasks but cannot edit.',
      roleCannotEditAgreements:
        'This workspace role can view agreements but cannot edit.',
      addNameFirst: 'Add a name first.',
      guestLimitReached: 'Up to {count} people can join this check-in.',
      personAdded: 'Person added.',
      noteAdded: 'Note added.',
      taskAdded: 'Task added.',
      agreementAdded: 'Agreement added.',
      keptForNow: 'Kept for now.',
      markedDone: 'Marked as done.',
      skippedForNow: 'Skipped for now.',
      movedToThisWeek: 'Moved to this week.',
      draftSaved: 'Draft saved on this phone.',
      finishMeeting: 'Finish Meeting',
      finishingMeeting: 'Finishing...',
      meetingFinished: 'Meeting finished.',
      ritualPaused: 'Ritual paused.',
      ritualResumed: 'Ritual resumed.',
      pauseRitualFailed: 'Could not pause this ritual.',
      resumeRitualFailed: 'Could not resume this ritual.',
      confirmEndSessionTitle: 'End this session?',
      confirmEndSessionText: 'Your progress will be saved as incomplete.',
      endSessionFailed: 'Could not end this session.',
      confirmDeleteRitualTitle: 'Delete this ritual?',
      confirmDeleteRitualText: 'This cannot be undone.',
      ritualDeleted: 'Ritual deleted.',
      deleteRitualFailed: 'Could not delete this ritual.',
      taskStatus: {
        open: 'Open',
        done: 'Done',
        skipped: 'Skipped',
      },
    },
    meetingStore: {
      openBeforeNote: 'Open a meeting before adding a note.',
      addShortNote: 'Add a short note first.',
      chooseNoteAuthor: 'Choose who is adding this note.',
      openBeforeTask: 'Open a meeting before adding a task.',
      taskTitleRequired: 'Task title is required.',
      chooseResponsible:
        'Choose a responsible person or mark it for discussion.',
      chooseFromMeeting: 'Choose someone from this meeting.',
      openBeforeAgreement: 'Open a meeting before adding an agreement.',
      addAgreementFirst: 'Add the agreement first.',
      chooseAgreementPeople: 'Choose who this agreement includes.',
      choosePeopleFromMeeting: 'Choose people from this meeting.',
      openBeforeFinish: 'Open a meeting before finishing.',
    },
    templates: {
      weeklyFamilyCheckIn: {
        name: 'Weekly family check-in',
        description:
          'The standard weekly rhythm for notes, tasks, and agreements.',
      },
      coupleReset: {
        name: 'Couple reset',
        description: 'A short practical reset for partners after a full week.',
      },
      familyWithKids: {
        name: 'Family with kids',
        description:
          'A focused check-in for routines, care, and kid logistics.',
      },
      moneyCheckIn: {
        name: 'Money check-in',
        description:
          'A simple agenda for household spending and money decisions.',
      },
      conflictCleanup: {
        name: 'Conflict cleanup',
        description: 'A calm way to turn one unresolved issue into next steps.',
      },
      busyWeekPlanning: {
        name: 'Busy week planning',
        description:
          'A practical plan for schedule, errands, and backup options.',
      },
      sections: {
        goodThings: {
          title: 'Good things',
          prompt: 'What went well this week?',
        },
        tensions: {
          title: 'Tensions',
          prompt: 'What felt stressful, unfair, or unresolved?',
        },
        tasks: {
          title: 'Tasks',
          prompt: 'What needs to be handled this week?',
        },
        money: {
          title: 'Money / purchases',
          prompt: 'What should we buy, pause, or decide about money?',
        },
        familyCare: {
          title: 'Kids / family care',
          prompt:
            'What needs attention around routines, care, or family needs?',
        },
        plans: {
          title: 'Plans',
          prompt: 'What is coming up next week?',
        },
        finalAgreements: {
          title: 'Final agreements',
          prompt: 'What should we agree on before we finish?',
        },
        appreciation: {
          title: 'Appreciation',
          prompt: 'What did you appreciate this week?',
        },
        frustrations: {
          title: 'Frustrations',
          prompt: 'What felt frustrating or hard to carry?',
        },
        emotionalLoad: {
          title: 'Emotional load',
          prompt: 'What felt mentally or emotionally heavy this week?',
        },
        timeTogether: {
          title: 'Time together',
          prompt: 'What time together would help this week?',
        },
        practicalAgreements: {
          title: 'Practical agreements',
          prompt: 'What should be clear before the next week starts?',
        },
        childRoutines: {
          title: 'Child routines',
          prompt: 'What routines need attention this week?',
        },
        school: {
          title: 'School / kindergarten',
          prompt: 'What should we remember for school or kindergarten?',
        },
        health: {
          title: 'Health',
          prompt: 'Any health needs, appointments, or care details?',
        },
        activities: {
          title: 'Activities',
          prompt: 'What activities need planning or support?',
        },
        parentResponsibilities: {
          title: 'Parent responsibilities',
          prompt: 'Who will take care of what this week?',
        },
        purchases: {
          title: 'Purchases',
          prompt: 'What needs to be bought, replaced, or decided?',
        },
        upcomingExpenses: {
          title: 'Upcoming expenses',
          prompt: 'What expenses are coming soon?',
        },
        subscriptionsBills: {
          title: 'Subscriptions / bills',
          prompt: 'What bills or subscriptions should we review?',
        },
        savingGoals: {
          title: 'Saving goals',
          prompt: 'What saving goal needs attention?',
        },
        financialConcerns: {
          title: 'Financial concerns',
          prompt: 'What money concern should we name clearly?',
        },
        decisions: {
          title: 'Decisions',
          prompt: 'What did we decide?',
        },
        whatHappened: {
          title: 'What happened',
          prompt: 'What happened, in simple terms?',
        },
        personNeeds: {
          title: 'What each person needs',
          prompt: 'What does each person need now?',
        },
        whatShouldChange: {
          title: 'What should change',
          prompt: 'What would make this less likely next time?',
        },
        concreteNextStep: {
          title: 'Concrete next step',
          prompt: 'What is the next clear action?',
        },
        followUpDate: {
          title: 'Follow-up date',
          prompt: 'When should we revisit this?',
        },
        scheduleOverview: {
          title: 'Schedule overview',
          prompt: 'What does the week look like?',
        },
        meals: {
          title: 'Meals',
          prompt: 'What meals or food decisions would make the week easier?',
        },
        childcare: {
          title: 'Childcare',
          prompt: 'What childcare needs to be covered?',
        },
        shopping: {
          title: 'Shopping',
          prompt: 'What shopping needs to happen?',
        },
        adminTasks: {
          title: 'Admin tasks',
          prompt: 'What admin tasks should not be missed?',
        },
        backupPlans: {
          title: 'Backup plans',
          prompt: 'What is the backup plan if the week changes?',
        },
      },
    },
    premium: {
      badge: 'Premium',
      feature: 'Premium feature',
      title: '{feature} is premium',
      message: 'Upgrade to use this feature.',
      viewPremium: 'View Premium',
      locked: 'Locked premium feature',
      unlock: 'Unlock',
    },
    features: {
      basicMeetings: {
        label: 'Basic weekly meetings',
        description: 'Create and run a simple weekly family meeting.',
      },
      defaultTemplate: {
        label: 'Default meeting template',
        description: 'Use the standard Weekly Us meeting agenda.',
      },
      tasksAndAgreements: {
        label: 'Tasks and agreements',
        description: 'Create household tasks and meeting agreements.',
      },
      manualResponsibility: {
        label: 'Manual responsibility assignment',
        description: 'Assign tasks and agreements to family members manually.',
      },
      limitedHistory: {
        label: 'Recent meeting history',
        description: 'Review the latest 3 completed meetings.',
      },
      localReminders: {
        label: 'Local reminders',
        description: 'Use simple device reminders when supported locally.',
        lockedReason: 'Upgrade to schedule local reminders on this device.',
      },
      unlimitedHistory: {
        label: 'Unlimited meeting history',
        description: 'Keep and review all completed meetings.',
        lockedReason:
          'Upgrade to keep the full record of your family meetings.',
      },
      aiSummary: {
        label: 'AI meeting summaries',
        description: 'Turn meeting notes into a clear summary and next steps.',
        lockedReason: 'Upgrade to generate meeting summaries automatically.',
      },
      agreementReminders: {
        label: 'Unfinished agreement reminders',
        description: 'Get reminders for agreements that still need follow-up.',
        lockedReason:
          'Upgrade to keep unfinished agreements visible between meetings.',
      },
      additionalTemplates: {
        label: 'Additional meeting templates',
        description:
          'Use templates for different family and household situations.',
        lockedReason: 'Upgrade to choose from more meeting formats.',
      },
      privateNotes: {
        label: 'Private notes',
        description: 'Keep personal notes separate from shared meeting notes.',
        lockedReason: 'Upgrade to add private notes to your meeting prep.',
      },
      googleCalendarSync: {
        label: 'Google Calendar sync',
        description: 'Sync meetings and follow-ups with Google Calendar.',
        lockedReason: 'Upgrade to connect Weekly Us with Google Calendar.',
      },
      export: {
        label: 'Export',
        description: 'Export meetings as PDF, text, or Markdown.',
        lockedReason: 'Upgrade to export meeting notes and agreements.',
      },
      advancedStatistics: {
        label: 'Advanced statistics',
        description: 'See deeper household patterns over time.',
        lockedReason:
          'Upgrade to unlock advanced household insights when available.',
      },
    },
    reminders: {
      title: 'Weekly Us',
      channelName: 'Weekly Us reminders',
      channelDescription: 'Gentle reminders for meetings and unfinished items.',
      weeklyMeetingBody: 'A gentle reminder for your weekly meeting.',
      unfinishedBoth:
        'A gentle reminder to review unfinished agreements and tasks.',
      unfinishedTasks: 'A gentle reminder to review unfinished tasks.',
      unfinishedAgreements:
        'A gentle reminder to review unfinished agreements.',
    },
    export: {
      meetingTitle: 'Weekly Us meeting',
      date: 'Date',
      status: 'Status',
      finished: 'finished',
      draft: 'draft',
      aiSummary: 'AI summary',
      aiDisclaimer:
        'AI summaries may be inaccurate. Review before relying on them.',
      mainTopics: 'Main topics discussed',
      keyTensions: 'Key tensions',
      agreementsMade: 'Agreements made',
      openTasks: 'Open tasks',
      revisitNextWeek: 'Topics to revisit next week',
      meetingSections: 'Meeting sections',
      notes: 'Notes',
      tasks: 'Tasks',
      agreements: 'Agreements',
      noNotes: 'No notes in this section.',
      noTasks: 'No tasks in this section.',
      noAgreements: 'No agreements in this section.',
      noOpenTasks: 'No open tasks were summarized.',
      privateNotesExcluded: 'Private notes are not included in this export.',
      people: 'People',
      responsible: 'Responsible',
      needsDiscussion: 'Needs discussion',
      shared: 'Shared',
      unassigned: 'Unassigned',
      due: 'Due',
      noneRecorded: 'None recorded.',
      clipboardUnavailable: 'Clipboard is not available in this browser.',
      taskStatus: {
        open: 'open',
        done: 'done',
        skipped: 'skipped',
      },
    },
    ai: {
      promptContract: [
        'Write a short neutral summary.',
        'List the main topics discussed.',
        'List agreements made.',
        'List open tasks and responsible people.',
        'List topics to revisit next week.',
        'Stay practical and non-judgmental.',
        'Do not act as a therapist or decide who is right or wrong.',
        'Do not include diagnostic or psychological claims.',
      ],
      emptyTensions: 'No specific tensions were recorded in this meeting.',
      emptyAgreements: 'No agreements were recorded in this meeting.',
      emptyFocus:
        'Review open tasks, confirm any new agreements, and revisit topics that still need a decision.',
      noTopics: 'No meeting topics were recorded.',
      checkProgress: 'Check progress on "{title}".',
      shortSummary:
        'This meeting covered {topics}. The notes show {agreementCount} {agreementWord} and {taskCount} {taskWord} to follow up.',
      agreementOne: 'agreement',
      agreementOther: 'agreements',
      taskOne: 'task',
      taskOther: 'tasks',
    },
    storage: {
      blocked:
        'Weekly Us cannot access local device storage. You can keep using this session, but changes may not persist.',
      parseFailed:
        'Some saved {label} data could not be read. The app kept the original local copy for recovery and started that part with safe defaults.',
      accessFailed:
        'Some saved {label} data could not be accessed. The app started that part with safe defaults.',
      newerVersion:
        'Saved data was created by a newer version of Weekly Us. The app kept a backup and started with safe local defaults.',
      missingMigration:
        'Saved data needs a migration this app version does not know yet. The app kept a backup and started with safe local defaults.',
      saveFailed:
        'Weekly Us could not save local changes on this device. Storage may be full or blocked. Your current session can continue, but changes may not persist.',
      appDataAccessFailed:
        'Saved Weekly Us data could not be accessed. The app started with safe defaults so you can keep using it.',
      invalidData:
        'Saved Weekly Us data did not match the expected format. A local backup was kept, and the app started with safe defaults so you can keep using it.',
      corruptData:
        'Saved Weekly Us data could not be read. A local backup was kept, and the app started with safe defaults so you can keep using it.',
      backupFailed:
        'Weekly Us could not create a local data backup because device storage may be full or blocked.',
    },
    notifications: {
      unavailable: 'Notifications are not available in this environment.',
      premiumOnly: 'Reminder scheduling is a premium feature.',
      updateFailed: 'Reminder scheduling could not be updated.',
    },
    api: {
      backendNotConfigured: 'Backend API is not configured.',
      backendContactFailed:
        'Something went wrong while contacting the backend.',
      saveSummaryNotConfigured:
        'Saving meeting summaries to the backend is not configured.',
      signInFailed: 'Something went wrong while signing in.',
      signUpFailed: 'Something went wrong while creating the account.',
    },
    sync: {
      backendUnavailable:
        'Backend API is not configured. Local data remains stored on this device.',
    },
  },
  uk: {
    app: {
      name: 'Weekly Us',
      navigationLabel: 'Основна навігація',
      openSettings: 'Відкрити налаштування',
      householdMembers: 'Учасники домогосподарства',
      storageAttention: 'Деякі збережені дані потребують уваги',
      dismiss: 'Закрити',
      routeTitles: {
        home: 'Weekly Us',
        meeting: 'Щотижневий ритуал',
        meetingTemplates: 'Виберіть шаблон',
        tasks: 'Побутові завдання',
        history: 'Історія',
        settings: 'Налаштування',
        upgrade: 'Premium',
        privateNotes: 'Приватні нотатки',
        calendarSync: 'Синхронізація календаря',
        workspaceSettings: 'Дім',
        account: 'Акаунт',
        meetingDetails: 'Підсумок зустрічі',
        meetingSummary: 'Підсумок зустрічі',
      },
      nav: {
        home: 'Головна',
        meeting: 'Зустріч',
        tasks: 'Завдання',
        history: 'Історія',
        settings: 'Налаштування',
      },
    },
    common: {
      add: 'Додати',
      available: 'Доступно',
      back: 'Назад',
      close: 'Закрити',
      copy: 'Копіювати',
      dismiss: 'Закрити',
      done: 'Готово',
      draft: 'Чернетка',
      due: 'До',
      enable: 'Увімкнути',
      exit: 'Вийти',
      export: 'Експорт',
      finish: 'Завершити',
      finished: 'Завершено',
      locked: 'Закрито',
      markdown: 'Markdown',
      next: 'Далі',
      noneRecorded: 'Нічого не записано.',
      open: 'Відкрито',
      pdf: 'PDF',
      remove: 'Видалити',
      resume: 'Продовжити',
      save: 'Зберегти',
      shareOrSave: 'Поділитися або зберегти',
      skipped: 'Пропущено',
      status: 'Статус',
      cancel: 'Скасувати',
      delete: 'Видалити',
      edit: 'Редагувати',
      email: 'Електронна пошта',
      password: 'Пароль',
      displayName: 'Відображуване ім’я',
      free: 'Безкоштовно',
      notAvailable: 'Недоступно',
      restorePurchases: 'Відновити покупки',
      manageSubscription: 'Керувати підпискою',
      goBack: 'Повернутися',
      localUser: 'Локальний користувач',
      weeklyUsUser: 'Користувач Weekly Us',
    },
    localization: {
      title: 'Мова',
      description:
        'Виберіть мову для елементів застосунку та системного тексту на цьому пристрої.',
      label: 'Мова застосунку',
    },
    account: {
      kicker: 'Акаунт',
      title: 'Налаштування акаунта',
      intro:
        'Керуйте моделлю акаунта на фронтенді для синхронізації, Premium-доступу та майбутніх функцій сімейного простору.',
      signedInAs: 'Увійшли як',
      plan: 'План',
      created: 'Створено',
      subscription: 'Підписка',
      currentPlan:
        'Поточний план: {plan}. Premium-доступ залежить від права підписки, а не лише від стану акаунта.',
      renewal: 'Поновлення',
      renewalUnavailable:
        'Недоступно, доки не буде додано справжній мобільний білінг.',
      manageSubscription: 'Керувати підпискою',
      manageAvailable: 'Доступно через магазин.',
      manageUnavailable: 'Лише заглушка. Платіжний провайдер не підключений.',
      viewPremium: 'Переглянути Premium',
      restorePurchases: 'Відновити покупки',
      profile: 'Профіль',
      profileHelp: 'У цьому MVP локально редагується лише відображуване ім’я.',
      saveAccount: 'Зберегти акаунт',
      session: 'Сеанс',
      mockSession:
        'Увімкнено mock-авторизацію. Токен доступу є заглушкою, справжній пароль локально не зберігається.',
      apiSession:
        'Запити з входом мають використовувати збережений токен доступу через API-шар.',
      logOut: 'Вийти',
      addDisplayName: 'Додайте відображуване ім’я.',
      updateFailed: 'Не вдалося оновити акаунт.',
      updated: 'Акаунт оновлено на цьому пристрої.',
    },
    auth: {
      signInKicker: 'Вхід',
      welcomeBack: 'Раді бачити знову',
      signInIntro:
        'Продовжуйте свій щотижневий домашній ритм із місця, де зупинилися.',
      forgotPassword: 'Забули пароль?',
      mockSignIn:
        'Увімкнено mock-авторизацію. Будь-яка електронна пошта й пароль створять тимчасовий frontend-сеанс.',
      signingIn: 'Вхід...',
      signIn: 'Увійти',
      newHere: 'Вперше у Weekly Us?',
      createAccount: 'Створити акаунт',
      createAccountIntro:
        'Створіть спокійне спільне місце для щотижневих зустрічей, домовленостей і домашніх справ.',
      yourName: 'Ваше ім’я',
      passwordHelp: 'Щонайменше 8 символів',
      mockSignUp:
        'Увімкнено mock-авторизацію. Пароль передається в mock-сервіс і локально не зберігається.',
      creating: 'Створення...',
      alreadyHaveAccount: 'Вже маєте акаунт?',
      passwordHelpKicker: 'Допомога з паролем',
      resetPasswordTitle: 'Заглушка скидання пароля.',
      resetPasswordIntro:
        'Backend-пошта ще не підключена. Цей екран готує потік акаунта, не вдаючи, що лист скидання надіслано.',
      resetPlaceholder:
        'Скидання пароля є заглушкою, доки не буде підключена backend-пошта.',
      remembered: 'Згадали?',
      addAccountEmail: 'Додайте електронну пошту вашого акаунта.',
      addEmail: 'Додайте адресу електронної пошти.',
      addPassword: 'Додайте пароль.',
      passwordLength: 'Використайте щонайменше 8 символів для пароля.',
      signInFailed: 'Не вдалося увійти.',
      signUpFailed: 'Не вдалося створити акаунт.',
      continue: 'Продовжити',
      emailPlaceholder: "you{'@'}example.com",
    },
    welcome: {
      tagline: 'Спокійніший спосіб планувати тиждень разом',
      intro:
        'Керована 15-хвилинна щотижнева зустріч для спільних завдань, практичних домовленостей і меншої кількості повторних домашніх розмов.',
      benefitsLabel: 'Навіщо створювати акаунт',
      syncLater: 'Синхронізація пізніше',
      syncLaterText:
        'Підготуйте доступ із кількох пристроїв, коли буде підключено backend-синхронізацію.',
      keepHistory: 'Зберігати історію',
      keepHistoryText:
        'Прив’язуйте зустрічі, домовленості й незавершені справи до себе.',
      premiumReady: 'Готово до Premium',
      premiumReadyText:
        'Використовуйте ту саму модель акаунта для платних функцій, коли додадуть платежі.',
      mockAuth:
        'Вхід в акаунт у цій збірці імітований. Справжній пароль локально не зберігається.',
      getStarted: 'Почати',
      continueLocal: 'Продовжити лише на цьому пристрої',
    },
    logout: {
      kicker: 'Вийти',
      title: 'Вийти з Weekly Us?',
      accountFallback: 'цього акаунта',
      intro:
        'Ви вийдете з {email} на цьому пристрої. Локальні дані зустрічей, уже збережені на цьому телефоні, не буде видалено.',
      help: 'Після виходу можна продовжити локально або знову увійти з екрана привітання.',
      loggingOut: 'Вихід...',
      keepSignedIn: 'Залишитися в акаунті',
    },
    home: {
      greeting: 'Доброго ранку,<br>{name}.',
      greetingPrefix: 'Доброго ранку,',
      householdFallback: 'ваш дім',
      heroTitle: 'Готові до 15-хвилинного щотижневого узгодження?',
      heroText:
        'Знайдіть хвилину, щоб узгодити наступний тиждень, помітити хороше й відновити контакт.',
      startMeeting: 'Почати зустріч',
      shortcutsLabel: 'Швидкі дії Weekly Us',
      tasksToReview: '{count} завдань для перегляду',
      fromCheckIns: 'Зі щотижневих зустрічей',
      meetingsSaved: '{count} зустрічей збережено',
      fullHistory: 'Повна історія доступна',
      freeLatest: 'Безкоштовно відкриває останні {count}',
      unlockHistory: 'Відкрити повну історію',
      unlockHistoryMessage:
        'Повертайтеся до старіших щотижневих зустрічей і домовленостей, коли дому потрібен контекст.',
    },
    history: {
      kicker: 'Історія зустрічей',
      title: 'Минулі зустрічі',
      intro:
        'Завершені зустрічі зберігаються локально. Безкоштовна історія відкриває останні {count} завершені зустрічі.',
      inProgress: 'У процесі',
      completedMeetings: 'Завершені зустрічі',
      defaultMeetingTitle: 'Щотижнева сімейна зустріч',
      draftedToday: 'Чернетку створено сьогодні',
      draftedYesterday: 'Чернетку створено вчора',
      draftedDaysAgo: 'Чернетку створено {count} дні тому',
      completedOn: 'Завершено у {day}',
      noDrafts: 'Немає зустрічі в процесі.',
      unlockFullHistory: 'Відкрити повну історію',
      unlockFullHistoryMessage:
        'Огляд минулого допомагає побачити, як далеко ви просунулися разом. Оновіться до Weekly Us Premium, щоб переглядати всі минулі зустрічі.',
      upgradePremium: 'Оновити Premium',
      privateNotes: 'Приватні нотатки',
      privateNotesText:
        'Тримайте особисті нотатки окремо від спільної історії зустрічей.',
      counts: '{notes} нотаток - {tasks} завдань - {agreements} домовленостей',
      deleteDraft: 'Видалити чернетку',
      confirmDeleteDraft:
        'Видалити цю чернетку? Нотатки, завдання та домовленості з неї буде видалено.',
      draftDeleted: 'Чернетку видалено.',
      lockedTitle: 'Старішу зустріч заблоковано',
      lockedMessage:
        'Безкоштовна історія відкриває останні {count} завершені зустрічі. Оновіться, щоб переглянути цю зустріч.',
      emptyTitle: 'Зустрічей ще немає',
      emptyText: 'Чернетки й завершені зустрічі з’являться тут.',
    },
    meetingSummary: {
      title: 'Підсумок зустрічі',
      mockTitle: 'Щотижнева сімейна зустріч',
      mockDate: '15 жовт. 2023',
      mockAiInsight:
        'Продуктивна зустріч була зосереджена на балансі майбутнього насиченого шкільного тижня. Настрій був співпрацею і підтримкою, усі погодили чіткий план спільних обов’язків.',
      mockDecisionScreenTime:
        'Домовилися обмежити екранний час до 1 години у будні вечори для всіх.',
      mockDecisionGroceries:
        'Sarah подбає про покупки продуктів у середу ввечері.',
      mockDecisionHiking:
        'Наступні вихідні присвячені сімейному походу в державному парку.',
      mockActionFaucet: 'Полагодити кран у гостьовій ванній',
      mockActionSoccer: 'Зареєструватися до осінньої футбольної ліги',
      aiInsight: 'AI-висновок',
      keyDecisions: 'Ключові рішення',
      actionItems: 'Дії',
      sentiment: 'Настрій',
      overallMood: 'Загальний настрій',
      positiveAligned: 'Позитивний і узгоджений',
      sentimentStrength: 'Сила настрою',
      shareSummary: 'Поділитися підсумком',
      copied: 'Підсумок скопійовано.',
      shared: 'Підсумком поділилися.',
      saved: 'Підсумок збережено як файл.',
      shareFailed: 'Не вдалося поділитися цим підсумком зараз.',
    },
    workspace: {
      title: 'Учасники дому',
      intro: 'Керуйте тим, хто має доступ до вашого спільного простору.',
      currentMembersLabel: 'Поточні учасники',
      member: 'Учасник',
      viewer: 'Переглядач',
      admin: 'Адмін',
      removeMember: 'Видалити учасника',
      pendingInvites: 'Очікувані запрошення',
      savedLocally: 'Збережено локально',
      resend: 'Надіслати ще раз',
      inviteKept: 'Запрошення залишено локально.',
      inviteNewMember: 'Запросити нового учасника',
      closeInviteForm: 'Закрити форму запрошення',
      goBack: 'Повернутися',
      addMember: 'Додати учасника',
      contact: 'Електронна пошта або номер телефону',
      contactPlaceholder: 'Введіть електронну пошту або номер телефону',
      role: 'Роль',
      inviteHelp:
        'Запрошені учасники отримають посилання для приєднання до щотижневого ритуалу вашого дому, коли backend-запрошення буде підключено.',
      sendInvitation: 'Надіслати запрошення',
      ownerInviteOnly: 'Лише власник може запрошувати учасників.',
      addContactFirst: 'Спочатку додайте електронну пошту або номер телефону.',
      saveInviteFailed: 'Не вдалося зберегти це запрошення.',
      invitationSaved:
        'Запрошення збережено локально. У цьому MVP лист не надсилається.',
      ownerRemoveOnly: 'Лише власник може видаляти учасників.',
      memberRemoved: 'Учасника видалено з простору.',
    },
    privateNotes: {
      kicker: 'Приватні нотатки',
      title: 'Особисті роздуми',
      intro:
        'Тримайте особисті думки окремо від спільних нотаток зустрічей, завдань і домовленостей.',
      storageLabel: 'Примітка про зберігання приватних нотаток',
      reflectionTitle: 'Для власних роздумів',
      storageText:
        'Приватні нотатки зберігаються на цьому пристрої в поточному MVP.',
      premiumTitle: 'Приватні нотатки доступні в Premium',
      premiumMessage:
        'Оновіться, щоб тримати особисту підготовку до зустрічей і роздуми окремо від спільних домашніх записів.',
      editTitle: 'Редагувати приватну нотатку',
      createTitle: 'Створити приватну нотатку',
      editorHelp:
        'Ці нотатки не потрапляють до спільних підсумків зустрічей і домовленостей.',
      titleLabel: 'Назва',
      titlePlaceholder: 'Про що це?',
      noteLabel: 'Нотатка',
      notePlaceholder: 'Запишіть те, що хочете пам’ятати для себе.',
      relatedMeeting: 'Пов’язана зустріч',
      noMeetingLink: 'Без посилання на зустріч',
      saveChanges: 'Зберегти зміни',
      saveNote: 'Зберегти нотатку',
      savedTitle: 'Збережені приватні нотатки',
      notesCount: '{count} особистих нотаток на цьому пристрої.',
      linkedTo: 'Пов’язано з {meeting}',
      noNotes:
        'Приватних нотаток ще немає. Додайте одну до або після зустрічі.',
      addTitleAndNote: 'Додайте назву й нотатку перед збереженням.',
      noteUpdated: 'Приватну нотатку оновлено.',
      noteSaved: 'Приватну нотатку збережено.',
      confirmDelete: 'Видалити цю приватну нотатку?',
      noteDeleted: 'Приватну нотатку видалено.',
    },
    templatePage: {
      kicker: 'Шаблони зустрічей',
      title: 'Виберіть формат',
      intro:
        'Виберіть порядок денний, який підходить цьому тижню. Стандартна щотижнева зустріч доступна всім.',
      continueDraft: 'Продовжити поточну зустріч',
      sectionsLabel: 'Розділи зустрічі',
      upgradeToUse: 'Оновитися',
      getPremium: 'Отримати Premium',
      startMeeting: 'Почати зустріч',
    },
    calendar: {
      kicker: 'Синхронізація календаря',
      title: 'Google Calendar',
      intro:
        'Підготуйте щотижневі зустрічі, дати завдань і повернення до тем для синхронізації з календарем.',
      placeholderTitle: 'Заглушка підключення',
      placeholderText:
        'Google OAuth і обробка токенів мають підтримуватися backend або безпечним рекомендованим потоком перед увімкненням справжньої синхронізації.',
      premiumTitle: 'Синхронізація Google Calendar доступна в Premium',
      premiumMessage:
        'Оновіться, щоб підготувати зустрічі Weekly Us, дати завдань і повернення до тем для Google Calendar.',
      connectionTitle: 'Підключення Google Calendar',
      checkingConnection: 'Перевірка підключення Google Calendar.',
      notConnected: 'Google Calendar не підключено.',
      preparingConnection: 'Підготовка підключення',
      connect: 'Підключити Google Calendar',
      disconnect: 'Відключити',
      noTokens: 'У цьому мобільному додатку токени Google не зберігаються.',
      optionsTitle: 'Параметри синхронізації',
      optionsText:
        'Виберіть, що Weekly Us має синхронізувати, коли Google Calendar буде готовий.',
      options: {
        weeklyMeeting: {
          label: 'Додати нагадування про щотижневу зустріч до календаря',
          description: 'Створити одну подію календаря для домашньої зустрічі.',
        },
        taskDueDates: {
          label: 'Додати дати виконання завдань до календаря',
          description:
            'Використовувати дати завдань, що потребують чіткого продовження.',
        },
        followUpDates: {
          label: 'Додати дати повернення до тем у календар',
          description:
            'Тримати узгоджені дати перегляду видимими між зустрічами.',
        },
      },
      setupRequired:
        'Підключення Google Calendar підготовлено, але безпечний OAuth ще не налаштовано.',
      addMeetingDate:
        'Додайте дату зустрічі перед синхронізацією нагадування календаря.',
      addTaskDueDate:
        'Додайте дату виконання завдання перед синхронізацією з Google Calendar.',
      addFollowUpDate:
        'Додайте дату повернення до теми перед синхронізацією з Google Calendar.',
      oauthWaiting:
        'Синхронізація календаря очікує безпечного потоку підключення Google.',
      checkFailed:
        'Щось пішло не так під час перевірки синхронізації календаря.',
      startFailed: 'Щось пішло не так під час запуску синхронізації календаря.',
      disconnectFailed:
        'Щось пішло не так під час відключення синхронізації календаря.',
    },
    upgrade: {
      kicker: 'Premium',
      title: 'Оновити Weekly Us',
      intro:
        'Premium для домів, яким потрібна довша пам’ять, м’яке нагадування і чисті підсумки після кожної щотижневої зустрічі.',
      heroTitle: 'Зробіть щотижневий ритуал легшим для перегляду',
      heroText:
        'Відкрийте практичні доповнення, не перетворюючи Weekly Us на трекер завдань або бюджетний додаток.',
      placeholdersTitle: 'Заглушки планів',
      placeholdersText:
        'Ціни й білінг будуть підключені пізніше через правильний мобільний потік підписок.',
      planOptionsLabel: 'Варіанти Premium-плану',
      premiumActive: 'Premium активний',
      startMockPremium: 'Запустити mock Premium',
      billingNote:
        'Цей paywall використовує лише mock-провайдера білінгу. У production справжній мобільний білінг має перевіряти права через довіреного провайдера або backend перед відкриттям Premium.',
      comparisonTitle: 'Порівняння планів',
      comparisonText:
        'Без тиску. Безкоштовний план залишає доступним основний потік щотижневої зустрічі.',
      statusTitle: 'Статус підписки',
      currentPlan: 'Поточний план: {plan}',
      renewal: 'Поновлення',
      manageSubscription: 'Керувати підпискою',
      account: 'Акаунт',
      renewalUnavailable:
        'Недоступно, доки не буде підключено справжній білінг.',
      manageAvailable: 'Доступно через магазин.',
      manageUnavailable: 'Керування мобільним білінгом буде додано пізніше.',
      localDeviceMode: 'Локальний режим пристрою',
      storeBillingNotConnected: 'Білінг магазину не підключено в цій збірці.',
      mockPurchasesDisabled: 'Mock-покупки вимкнені у production-збірках.',
      planUnavailable: 'Цей Premium-план недоступний.',
      mockPremiumEnabled: 'Mock Premium увімкнено на цьому пристрої.',
      mockPremiumRestored: 'Mock Premium відновлено на цьому пристрої.',
      noMockPremium: 'Mock-покупку Premium на цьому пристрої не знайдено.',
      managementLater:
        'Керування підпискою відкриватиме налаштування Google Play або App Store після налаштування справжнього білінгу.',
      checkFailed: 'Щось пішло не так під час перевірки Premium-доступу.',
      startFailed: 'Щось пішло не так під час запуску Premium.',
      restoreFailed: 'Щось пішло не так під час відновлення покупок.',
      manageFailed: 'Щось пішло не так під час відкриття керування підпискою.',
      plans: {
        premiumMonthly: {
          name: 'Щомісячний',
          priceLabel: 'Ціна очікується',
          description: 'Гнучкий Premium-варіант для mock paywall.',
        },
        premiumYearly: {
          name: 'Річний',
          priceLabel: 'Ціна очікується',
          description: 'Річний Premium-варіант для mock paywall.',
        },
      },
    },
    settings: {
      kicker: 'Налаштування',
      title: 'Налаштування дому',
      intro:
        'Керуйте локальним списком людей для нотаток, завдань і домовленостей.',
      account: 'Акаунт',
      signedInAs: 'Ви увійшли як {email}.',
      signedInFallback: 'ваш акаунт',
      localOnly: 'Weekly Us використовується лише на цьому пристрої.',
      noAccount: 'Акаунт ще не підключено.',
      accountSettings: 'Налаштування акаунта',
      accountOptions: 'Опції акаунта',
      workspaceSettings: 'Налаштування дому',
      calendarSync: 'Синхронізація календаря',
      legal: 'Юридичне',
      legalText:
        'Тимчасові документи для внутрішнього тестування. Перевірте перед публічним запуском.',
      privacyPolicy: 'Політика конфіденційності',
      terms: 'Умови',
      reminders: 'Нагадування',
      reminderPremiumTitle: 'Налаштування нагадувань доступні в Premium',
      reminderPremiumMessage:
        'Оновіться, щоб планувати м’які локальні нагадування про щотижневі зустрічі та незавершені домашні справи.',
      reminderIntro:
        'Weekly Us може використовувати локальні сповіщення пристрою для зустрічі та незавершених справ. Push-сповіщення та акаунт не потрібні.',
      enableReminders: 'Увімкнути нагадування',
      weeklyMeetingReminder: 'Нагадування про щотижневу зустріч',
      unfinishedTaskReminder: 'Нагадування про незавершені справи',
      day: 'День',
      time: 'Час',
      reminderExample:
        'Приклад: м’яке нагадування переглянути незавершені домовленості.',
      reminderLocked: 'Налаштування нагадувань доступні з Premium.',
      remindersOff: 'Нагадування вимкнені.',
      notificationsUnavailable:
        'Локальні сповіщення доступні в Android-застосунку. У вебрежимі розробки ці налаштування зберігаються без планування сповіщень.',
      notificationsBlocked: 'Сповіщення заблоковані в системних налаштуваннях.',
      remindersScheduled: 'Нагадування заплановані на цьому пристрої.',
      remindersSaved:
        'Нагадування збережені й будуть заплановані, коли сповіщення стануть доступні.',
      participants: 'Учасники',
      participantsIntro:
        'Поки що зберігаються на цьому пристрої. Без акаунтів і запрошень.',
      name: 'Ім’я',
      initials: 'Ініціали',
      auto: 'Авто',
      type: 'Тип',
      avatarColor: 'Колір аватара',
      color: 'Колір',
      addParticipant: 'Додати учасника',
      participantAdded: 'Учасника додано.',
      participantUpdated: 'Учасника оновлено.',
      participantEnabled: 'Учасника увімкнено.',
      participantDisabled:
        'Учасника вимкнено. Існуючі записи зберігають його ім’я.',
      participantRemoved: 'Невикористаного учасника видалено.',
      addNameFirst: 'Спочатку додайте ім’я.',
      disable: 'Вимкнути',
      mockWorkspaceRole: 'Тестова роль у домі',
      premiumFeatureChecks: 'Перевірка Premium-функцій',
      role: {
        owner: 'Власник',
        adultMember: 'Дорослий учасник',
        viewer: 'Перегляд',
      },
      defaultParticipant: {
        me: 'Я',
        partner: 'Партнер',
      },
      defaultWorkspace: 'Наш щотижневий простір',
      participantType: {
        adult: 'Дорослий',
        child: 'Дитина',
        other: 'Інше',
      },
    },
    tasksPage: {
      kicker: 'Завдання',
      title: 'Що ми домовилися зробити',
      intro: 'Легке місце для домашніх справ із ваших щотижневих зустрічей.',
      openTasks: 'Відкриті завдання',
      stillRelevantCount: '{count} ще актуальні',
      readOnlyTasks:
        'Ця роль у просторі може переглядати завдання, але не редагувати їх.',
      task: 'Завдання',
      responsible: 'Відповідальний',
      needsDiscussion: 'Потрібно обговорити',
      shared: 'Спільно',
      disabledParticipant: ' (вимкнено)',
      stillRelevant: 'Ще актуально?',
      fromMeeting: 'З {meeting}',
      skip: 'Пропустити',
      doneTasks: 'Виконані завдання ({count})',
      skippedTasks: 'Пропущені завдання ({count})',
      reopen: 'Відкрити знову',
      bringBack: 'Повернути',
      noOpenTasks: 'Зараз немає відкритих завдань.',
      nothingDone: 'Ще нічого не позначено виконаним.',
      noSkippedTasks: 'Пропущених завдань немає.',
      recentAgreements: 'Останні домовленості',
      agreementsIntro: 'Рішення, збережені зі щотижневих зустрічей.',
      noAgreements: 'Збережених домовленостей ще немає.',
      agreement: 'Домовленість',
      date: 'Дата',
      meeting: 'Зустріч',
      people: 'Люди',
      relatedTasks: 'Пов’язані завдання',
      addShortTitle: 'Спочатку додайте коротку назву.',
      taskUpdated: 'Завдання оновлено.',
      markedDone: 'Позначено виконаним.',
      updated: 'Оновлено.',
      ownerDeleteOnly: 'Лише власник може видаляти завдання.',
      confirmDeleteTask: 'Видалити це завдання?',
      taskDeleted: 'Завдання видалено.',
    },
    legal: {
      backToSettings: 'Назад до налаштувань',
      privacy: {
        kicker: 'Політика конфіденційності',
        title: 'Конфіденційність Weekly Us',
        intro:
          'Заглушка для внутрішнього тестування. Замініть її на перевірену політику перед будь-яким публічним релізом у Google Play.',
        dataTitle: 'Поточна модель даних MVP',
        dataText:
          'Weekly Us зберігає нотатки зустрічей, завдання, домовленості, учасників, приватні нотатки, налаштування та mock-стан Premium локально на цьому пристрої. Backend-синхронізацію в поточному MVP не підключено.',
        privateNotesTitle: 'Приватні нотатки',
        privateNotesText:
          'Приватні нотатки зберігаються на цьому пристрої в поточному MVP. За замовчуванням вони не включаються в експорт зустрічей.',
        aiTitle: 'Заглушки AI та Premium',
        aiText:
          'AI-підсумки використовують локального mock-провайдера, якщо backend API явно не увімкнено. AI-підсумки можуть бути неточними. Перевіряйте їх перед використанням.',
        premiumText:
          'Екрани Premium і білінгу використовують mock-стан підписки лише для внутрішнього тестування. Справжні платежі не підключені.',
      },
      terms: {
        kicker: 'Умови',
        title: 'Умови Weekly Us',
        intro:
          'Заглушка для внутрішнього тестування. Замініть її на перевірені умови перед будь-яким публічним релізом у Google Play.',
        testingTitle: 'Лише внутрішнє тестування',
        testingText:
          'Ця збірка підготовлена для внутрішнього тестування. Вона не готова для публічного поширення, платних підписок, backend-синхронізації або production-підтримки.',
        adviceTitle: 'Не професійна порада',
        adviceText:
          'Weekly Us є практичним інструментом домашніх зустрічей. Це не терапія, юридична порада, фінансова порада або екстрена підтримка.',
        localDataTitle: 'Відповідальність за локальні дані',
        localDataText:
          'Дані зберігаються локально на цьому пристрої в поточному MVP. Користувачам варто перевіряти важливі домовленості перед тим, як покладатися на них, і розуміти, що видалення додатка або очищення сховища може видалити локальні дані.',
      },
    },
    days: {
      sunday: 'Неділя',
      monday: 'Понеділок',
      tuesday: 'Вівторок',
      wednesday: 'Середа',
      thursday: 'Четвер',
      friday: 'П’ятниця',
      saturday: 'Субота',
    },
    meeting: {
      closeMeeting: 'Закрити зустріч',
      stepOf: 'Крок {current} з {total}',
      saveDraft: 'Зберегти чернетку',
      menu: {
        label: 'Меню ритуалу',
        open: 'Відкрити меню ритуалу',
        pauseRitual: 'Призупинити ритуал',
        resumeRitual: 'Продовжити ритуал',
        saveDraftExit: 'Зберегти чернетку і вийти',
        endSession: 'Завершити сесію',
        deleteRitual: 'Видалити ритуал',
      },
      notes: 'Нотатки',
      author: 'Автор',
      note: 'Нотатка',
      addNote: 'Додати нотатку',
      noNotesYet: 'Нотаток ще немає.',
      noNotesInSection: 'У цьому розділі немає нотаток.',
      tasks: 'Завдання',
      taskTitle: 'Назва завдання',
      optionalDetail: 'Додаткова деталь',
      responsible: 'Відповідальний',
      dueDate: 'Дата виконання',
      addTask: 'Додати завдання',
      noTasksYet: 'Завдань ще немає.',
      noTasksInSection: 'У цьому розділі немає завдань.',
      agreements: 'Домовленості',
      decisionOrAgreement: 'Рішення або домовленість',
      participants: 'Учасники',
      addAgreement: 'Додати домовленість',
      noAgreementsYet: 'Домовленостей ще немає.',
      noAgreementsInSection: 'У цьому розділі немає домовленостей.',
      reviewTogether: 'Перегляньте разом',
      reviewIntro:
        'Перегляньте нотатки, завдання й домовленості перед завершенням.',
      tasksAndResponsibilities: 'Завдання і відповідальність',
      atLeastOne:
        'Додайте хоча б одну нотатку, завдання або домовленість перед завершенням.',
      finished: 'Цю зустріч завершено.',
      newMeeting: 'Нова зустріч',
      weeklyMeeting: 'Щотижнева зустріч',
      readOnlyTitle: 'Доступ лише для перегляду',
      readOnlyText:
        'Глядачі можуть бачити спільні підсумки й завдання, але не можуть починати або редагувати щотижневу зустріч.',
      viewHistory: 'Переглянути історію',
      formerParticipant: 'Колишній учасник',
      someone: 'Хтось',
      shared: 'Спільно',
      needsDiscussion: 'Потрібно обговорити',
      unassigned: 'Не призначено',
      recentMeeting: 'Нещодавня зустріч',
      fromMeeting: 'З {title} - {date}',
      unfinishedTitle: 'Що зробити з незавершеними завданнями?',
      stillRelevant: 'Ще актуально? {date}',
      unfinishedChoices: 'Варіанти для незавершених завдань',
      keep: 'Залишити',
      markDone: 'Позначити виконаним',
      skip: 'Пропустити',
      moveToThisWeek: 'Перенести на цей тиждень',
      noContentPreview: 'Нотаток, завдань або домовленостей ще немає.',
      meetingNotFound: 'Зустріч не знайдено',
      notSaved: 'Цю зустріч не збережено на цьому пристрої.',
      backToHistory: 'Назад до історії',
      olderMeetingLocked: 'Старішу зустріч закрито',
      freeHistoryLimit:
        'Безкоштовна історія відкриває останні {count} завершені зустрічі. Оновіться, щоб переглядати всі розділи, нотатки, завдання й домовленості.',
      exportPremiumTitle: 'Експорт доступний у Premium',
      exportPremiumMessage:
        'Оновіться, щоб експортувати підсумки зустрічей, домовленості й завдання.',
      exportMeeting: 'Експортувати зустріч',
      exportHelp:
        'Збережіть чисту копію підсумку, нотаток, завдань і домовленостей. Приватні нотатки не включаються.',
      aiPremiumTitle: 'AI-підсумки доступні в Premium',
      aiPremiumMessage:
        'Оновіться, щоб створювати нейтральні підсумки зустрічей і наступні кроки.',
      aiSummary: 'AI-підсумок',
      aiDisclaimer:
        'AI-підсумки можуть бути неточними. Перевіряйте їх перед використанням. Це не професійна порада щодо стосунків.',
      generate: 'Створити',
      regenerate: 'Створити знову',
      generateSummary: '{action} підсумок',
      mainTopics: 'Основні теми',
      keyTensions: 'Ключові напруження',
      agreementsMade: 'Домовленості',
      openTasks: 'Відкриті завдання',
      noOpenTasksSummarized: 'Відкриті завдання не підсумовано.',
      revisitNextWeek: 'Теми для повернення наступного тижня',
      generateEmpty:
        'Створіть нейтральний підсумок зустрічі, домовленостей і наступних кроків.',
      exportChoose: 'Виберіть простий формат. Приватні нотатки не включаються.',
      format: 'Формат',
      plainText: 'Звичайний текст',
      plainTextHelp: 'Зручно для копіювання в повідомлення або нотатки.',
      markdownHelp: 'Чисті заголовки й списки для документів.',
      copied: 'Експорт скопійовано в буфер.',
      copyFailed:
        'Не вдалося скопіювати експорт. Спробуйте поділитися або зберегти.',
      sharedExport: 'Експортом поділилися.',
      savedExport: 'Експорт збережено як файл.',
      shareFailed: 'Не вдалося поділитися або зберегти експорт зараз.',
      printOpened:
        'Вікно друку відкрито. Виберіть “Зберегти як PDF”, якщо доступно.',
      printFailed: 'Не вдалося відкрити PDF-перегляд на цьому пристрої.',
      generateFailed: 'Не вдалося створити підсумок зараз.',
      notePlaceholders: {
        goodThings: 'Одна річ, яку я оцінив/оцінила...',
        tensions: 'Я помітив/помітила, що це було складно, бо...',
        tasks: 'Корисна деталь на цей тиждень...',
        money: 'Щось купити або вирішити щодо грошей...',
        familyCare: 'Нотатка про сімейний догляд...',
        plans: 'Наступного тижня буде...',
        finalAgreements: 'Рішення, яке хочемо зберегти...',
        default: 'Додайте коротку практичну нотатку...',
      },
      taskTitlePlaceholder: 'Що потребує уваги?',
      taskDetailPlaceholder: 'Що допоможе зробити це простіше?',
      agreementPlaceholder: 'Про що ми домовилися?',
      neutralHint:
        'Спробуйте назвати, що сталося і що допоможе, без ярликів чи звинувачень.',
      roleCannotEditMeetings:
        'Ця роль може переглядати зустрічі, але не може їх редагувати.',
      roleCannotEditTasks:
        'Ця роль може переглядати завдання, але не може їх редагувати.',
      roleCannotEditAgreements:
        'Ця роль може переглядати домовленості, але не може їх редагувати.',
      addNameFirst: 'Спочатку додайте ім’я.',
      guestLimitReached:
        'До цієї зустрічі можуть приєднатися до {count} людей.',
      personAdded: 'Людину додано.',
      noteAdded: 'Нотатку додано.',
      taskAdded: 'Завдання додано.',
      agreementAdded: 'Домовленість додано.',
      keptForNow: 'Поки залишено.',
      markedDone: 'Позначено виконаним.',
      skippedForNow: 'Поки пропущено.',
      movedToThisWeek: 'Перенесено на цей тиждень.',
      draftSaved: 'Чернетку збережено на цьому телефоні.',
      meetingFinished: 'Зустріч завершено.',
      ritualPaused: 'Ритуал призупинено.',
      ritualResumed: 'Ритуал продовжено.',
      pauseRitualFailed: 'Не вдалося призупинити цей ритуал.',
      resumeRitualFailed: 'Не вдалося продовжити цей ритуал.',
      confirmEndSessionTitle: 'Завершити цю сесію?',
      confirmEndSessionText: 'Ваш прогрес буде збережено як незавершений.',
      endSessionFailed: 'Не вдалося завершити цю сесію.',
      confirmDeleteRitualTitle: 'Видалити цей ритуал?',
      confirmDeleteRitualText: 'Цю дію не можна скасувати.',
      ritualDeleted: 'Ритуал видалено.',
      deleteRitualFailed: 'Не вдалося видалити цей ритуал.',
      taskStatus: {
        open: 'Відкрито',
        done: 'Готово',
        skipped: 'Пропущено',
      },
    },
    meetingStore: {
      openBeforeNote: 'Відкрийте зустріч, перш ніж додавати нотатку.',
      addShortNote: 'Спочатку додайте коротку нотатку.',
      chooseNoteAuthor: 'Виберіть, хто додає цю нотатку.',
      openBeforeTask: 'Відкрийте зустріч, перш ніж додавати завдання.',
      taskTitleRequired: 'Назва завдання обов’язкова.',
      chooseResponsible:
        'Виберіть відповідального або позначте для обговорення.',
      chooseFromMeeting: 'Виберіть когось із цієї зустрічі.',
      openBeforeAgreement: 'Відкрийте зустріч, перш ніж додавати домовленість.',
      addAgreementFirst: 'Спочатку додайте домовленість.',
      chooseAgreementPeople: 'Виберіть, кого стосується ця домовленість.',
      choosePeopleFromMeeting: 'Виберіть людей із цієї зустрічі.',
      openBeforeFinish: 'Відкрийте зустріч перед завершенням.',
    },
    templates: {
      weeklyFamilyCheckIn: {
        name: 'Щотижнева сімейна зустріч',
        description:
          'Стандартний щотижневий ритм для нотаток, завдань і домовленостей.',
      },
      coupleReset: {
        name: 'Перезапуск для пари',
        description:
          'Коротке практичне узгодження для партнерів після насиченого тижня.',
      },
      familyWithKids: {
        name: 'Сім’я з дітьми',
        description:
          'Сфокусована зустріч про рутини, догляд і дитячу логістику.',
      },
      moneyCheckIn: {
        name: 'Грошова зустріч',
        description:
          'Простий порядок денний для домашніх витрат і фінансових рішень.',
      },
      conflictCleanup: {
        name: 'Розбір конфлікту',
        description:
          'Спокійний спосіб перетворити одну невирішену тему на наступні кроки.',
      },
      busyWeekPlanning: {
        name: 'Планування насиченого тижня',
        description:
          'Практичний план для розкладу, справ і запасних варіантів.',
      },
      sections: {
        goodThings: {
          title: 'Що було добре',
          prompt: 'Що добре вийшло цього тижня?',
        },
        tensions: {
          title: 'Напруження',
          prompt: 'Що було стресовим, несправедливим або невирішеним?',
        },
        tasks: {
          title: 'Завдання',
          prompt: 'Що потрібно зробити цього тижня?',
        },
        money: {
          title: 'Гроші / покупки',
          prompt: 'Що купити, відкласти або вирішити щодо грошей?',
        },
        familyCare: {
          title: 'Діти / сімейний догляд',
          prompt: 'Що потребує уваги в рутинах, догляді або сімейних потребах?',
        },
        plans: {
          title: 'Плани',
          prompt: 'Що буде наступного тижня?',
        },
        finalAgreements: {
          title: 'Фінальні домовленості',
          prompt: 'Про що варто домовитися перед завершенням?',
        },
        appreciation: {
          title: 'Вдячність',
          prompt: 'Що ви оцінили цього тижня?',
        },
        frustrations: {
          title: 'Роздратування',
          prompt: 'Що було прикрим або важким нести?',
        },
        emotionalLoad: {
          title: 'Емоційне навантаження',
          prompt: 'Що було ментально або емоційно важким цього тижня?',
        },
        timeTogether: {
          title: 'Час разом',
          prompt: 'Який час разом допоміг би цього тижня?',
        },
        practicalAgreements: {
          title: 'Практичні домовленості',
          prompt: 'Що має бути зрозуміло перед початком наступного тижня?',
        },
        childRoutines: {
          title: 'Дитячі рутини',
          prompt: 'Які рутини потребують уваги цього тижня?',
        },
        school: {
          title: 'Школа / садок',
          prompt: 'Що потрібно пам’ятати для школи або садка?',
        },
        health: {
          title: 'Здоров’я',
          prompt: 'Є потреби щодо здоров’я, записи або деталі догляду?',
        },
        activities: {
          title: 'Активності',
          prompt: 'Які активності потребують планування або підтримки?',
        },
        parentResponsibilities: {
          title: 'Батьківська відповідальність',
          prompt: 'Хто про що подбає цього тижня?',
        },
        purchases: {
          title: 'Покупки',
          prompt: 'Що потрібно купити, замінити або вирішити?',
        },
        upcomingExpenses: {
          title: 'Майбутні витрати',
          prompt: 'Які витрати скоро будуть?',
        },
        subscriptionsBills: {
          title: 'Підписки / рахунки',
          prompt: 'Які рахунки або підписки варто переглянути?',
        },
        savingGoals: {
          title: 'Цілі заощаджень',
          prompt: 'Яка ціль заощаджень потребує уваги?',
        },
        financialConcerns: {
          title: 'Фінансові занепокоєння',
          prompt: 'Яку грошову турботу варто чітко назвати?',
        },
        decisions: {
          title: 'Рішення',
          prompt: 'Що ми вирішили?',
        },
        whatHappened: {
          title: 'Що сталося',
          prompt: 'Що сталося простими словами?',
        },
        personNeeds: {
          title: 'Що потрібно кожному',
          prompt: 'Що зараз потрібно кожній людині?',
        },
        whatShouldChange: {
          title: 'Що має змінитися',
          prompt: 'Що допоможе, щоб це рідше повторювалося?',
        },
        concreteNextStep: {
          title: 'Конкретний наступний крок',
          prompt: 'Яка наступна чітка дія?',
        },
        followUpDate: {
          title: 'Дата повернення',
          prompt: 'Коли варто повернутися до цієї теми?',
        },
        scheduleOverview: {
          title: 'Огляд розкладу',
          prompt: 'Як виглядає тиждень?',
        },
        meals: {
          title: 'Їжа',
          prompt: 'Які рішення щодо їжі зробили б тиждень простішим?',
        },
        childcare: {
          title: 'Догляд за дітьми',
          prompt: 'Який догляд за дітьми потрібно покрити?',
        },
        shopping: {
          title: 'Покупки',
          prompt: 'Які покупки потрібно зробити?',
        },
        adminTasks: {
          title: 'Адміністративні справи',
          prompt: 'Які адміністративні справи не можна пропустити?',
        },
        backupPlans: {
          title: 'Запасні плани',
          prompt: 'Який запасний план, якщо тиждень зміниться?',
        },
      },
    },
    premium: {
      badge: 'Premium',
      feature: 'Premium-функція',
      title: '{feature} доступно в Premium',
      message: 'Оновіться, щоб користуватися цією функцією.',
      viewPremium: 'Переглянути Premium',
      locked: 'Закрита Premium-функція',
      unlock: 'Розблокувати',
    },
    features: {
      basicMeetings: {
        label: 'Базові щотижневі зустрічі',
        description: 'Створюйте й проводьте просту щотижневу сімейну зустріч.',
      },
      defaultTemplate: {
        label: 'Стандартний шаблон зустрічі',
        description: 'Використовуйте стандартний порядок денний Weekly Us.',
      },
      tasksAndAgreements: {
        label: 'Завдання і домовленості',
        description: 'Створюйте домашні завдання й домовленості зі зустрічей.',
      },
      manualResponsibility: {
        label: 'Ручне призначення відповідальності',
        description: 'Призначайте завдання й домовленості учасникам вручну.',
      },
      limitedHistory: {
        label: 'Нещодавня історія зустрічей',
        description: 'Переглядайте останні 3 завершені зустрічі.',
      },
      localReminders: {
        label: 'Локальні нагадування',
        description: 'Використовуйте прості нагадування на пристрої.',
        lockedReason:
          'Оновіться, щоб планувати локальні нагадування на цьому пристрої.',
      },
      unlimitedHistory: {
        label: 'Необмежена історія зустрічей',
        description: 'Зберігайте й переглядайте всі завершені зустрічі.',
        lockedReason:
          'Оновіться, щоб зберігати повний запис сімейних зустрічей.',
      },
      aiSummary: {
        label: 'AI-підсумки зустрічей',
        description:
          'Перетворюйте нотатки зустрічі на чіткий підсумок і наступні кроки.',
        lockedReason:
          'Оновіться, щоб автоматично створювати підсумки зустрічей.',
      },
      agreementReminders: {
        label: 'Нагадування про незавершені домовленості',
        description:
          'Отримуйте нагадування про домовленості, які ще потребують уваги.',
        lockedReason:
          'Оновіться, щоб незавершені домовленості залишалися видимими між зустрічами.',
      },
      additionalTemplates: {
        label: 'Додаткові шаблони зустрічей',
        description:
          'Використовуйте шаблони для різних сімейних і домашніх ситуацій.',
        lockedReason: 'Оновіться, щоб вибирати більше форматів зустрічей.',
      },
      privateNotes: {
        label: 'Приватні нотатки',
        description: 'Зберігайте особисті нотатки окремо від спільних.',
        lockedReason:
          'Оновіться, щоб додавати приватні нотатки до підготовки зустрічі.',
      },
      googleCalendarSync: {
        label: 'Синхронізація Google Calendar',
        description:
          'Синхронізуйте зустрічі й наступні кроки з Google Calendar.',
        lockedReason: 'Оновіться, щоб підключити Weekly Us до Google Calendar.',
      },
      export: {
        label: 'Експорт',
        description: 'Експортуйте зустрічі як PDF, текст або Markdown.',
        lockedReason:
          'Оновіться, щоб експортувати нотатки й домовленості зустрічей.',
      },
      advancedStatistics: {
        label: 'Розширена статистика',
        description: 'Дивіться глибші домашні патерни з часом.',
        lockedReason:
          'Оновіться, щоб відкрити розширені інсайти, коли вони будуть доступні.',
      },
    },
    reminders: {
      title: 'Weekly Us',
      channelName: 'Нагадування Weekly Us',
      channelDescription:
        'М’які нагадування про зустрічі та незавершені справи.',
      weeklyMeetingBody: 'М’яке нагадування про вашу щотижневу зустріч.',
      unfinishedBoth:
        'М’яке нагадування переглянути незавершені домовленості й завдання.',
      unfinishedTasks: 'М’яке нагадування переглянути незавершені завдання.',
      unfinishedAgreements:
        'М’яке нагадування переглянути незавершені домовленості.',
    },
    export: {
      meetingTitle: 'Зустріч Weekly Us',
      date: 'Дата',
      status: 'Статус',
      finished: 'завершено',
      draft: 'чернетка',
      aiSummary: 'AI-підсумок',
      aiDisclaimer:
        'AI-підсумки можуть бути неточними. Перевіряйте їх перед використанням.',
      mainTopics: 'Основні теми',
      keyTensions: 'Ключові напруження',
      agreementsMade: 'Домовленості',
      openTasks: 'Відкриті завдання',
      revisitNextWeek: 'Теми для повернення наступного тижня',
      meetingSections: 'Розділи зустрічі',
      notes: 'Нотатки',
      tasks: 'Завдання',
      agreements: 'Домовленості',
      noNotes: 'У цьому розділі немає нотаток.',
      noTasks: 'У цьому розділі немає завдань.',
      noAgreements: 'У цьому розділі немає домовленостей.',
      noOpenTasks: 'Відкриті завдання не підсумовано.',
      privateNotesExcluded: 'Приватні нотатки не включені в цей експорт.',
      people: 'Люди',
      responsible: 'Відповідальний',
      needsDiscussion: 'Потрібно обговорити',
      shared: 'Спільно',
      unassigned: 'Не призначено',
      due: 'До',
      noneRecorded: 'Нічого не записано.',
      clipboardUnavailable: 'Буфер обміну недоступний у цьому браузері.',
      taskStatus: {
        open: 'відкрито',
        done: 'готово',
        skipped: 'пропущено',
      },
    },
    ai: {
      promptContract: [
        'Напишіть короткий нейтральний підсумок.',
        'Перелічіть основні обговорені теми.',
        'Перелічіть досягнуті домовленості.',
        'Перелічіть відкриті завдання та відповідальних людей.',
        'Перелічіть теми, до яких варто повернутися наступного тижня.',
        'Залишайтеся практичними й неосудливими.',
        'Не дійте як терапевт і не вирішуйте, хто правий чи винний.',
        'Не додавайте діагностичних або психологічних тверджень.',
      ],
      emptyTensions: 'У цій зустрічі не записано конкретних напружень.',
      emptyAgreements: 'У цій зустрічі не записано домовленостей.',
      emptyFocus:
        'Перегляньте відкриті завдання, підтвердьте нові домовленості й поверніться до тем, які ще потребують рішення.',
      noTopics: 'Тем зустрічі не записано.',
      checkProgress: 'Перевірити прогрес щодо “{title}”.',
      shortSummary:
        'Зустріч охопила: {topics}. У нотатках є {agreementCount} {agreementWord} і {taskCount} {taskWord} для подальших дій.',
      agreementOne: 'домовленість',
      agreementOther: 'домовленостей',
      taskOne: 'завдання',
      taskOther: 'завдань',
    },
    storage: {
      blocked:
        'Weekly Us не може отримати доступ до локального сховища пристрою. Ви можете продовжити цей сеанс, але зміни можуть не зберегтися.',
      parseFailed:
        'Деякі збережені дані {label} не вдалося прочитати. Додаток зберіг оригінальну локальну копію для відновлення і запустив цю частину з безпечними типовими значеннями.',
      accessFailed:
        'Не вдалося отримати доступ до деяких збережених даних {label}. Додаток запустив цю частину з безпечними типовими значеннями.',
      newerVersion:
        'Збережені дані створені новішою версією Weekly Us. Додаток зберіг резервну копію і запустився з безпечними локальними типовими значеннями.',
      missingMigration:
        'Збережені дані потребують міграції, якої ця версія додатка ще не знає. Додаток зберіг резервну копію і запустився з безпечними локальними типовими значеннями.',
      saveFailed:
        'Weekly Us не зміг зберегти локальні зміни на цьому пристрої. Сховище може бути переповнене або заблоковане. Поточний сеанс може тривати, але зміни можуть не зберегтися.',
      appDataAccessFailed:
        'Не вдалося отримати доступ до збережених даних Weekly Us. Додаток запустився з безпечними типовими значеннями, щоб ви могли продовжити користування.',
      invalidData:
        'Збережені дані Weekly Us не відповідають очікуваному формату. Локальну резервну копію збережено, а додаток запустився з безпечними типовими значеннями.',
      corruptData:
        'Збережені дані Weekly Us не вдалося прочитати. Локальну резервну копію збережено, а додаток запустився з безпечними типовими значеннями.',
      backupFailed:
        'Weekly Us не зміг створити локальну резервну копію даних, бо сховище пристрою може бути переповнене або заблоковане.',
    },
    notifications: {
      unavailable: 'Сповіщення недоступні в цьому середовищі.',
      premiumOnly: 'Планування нагадувань є Premium-функцією.',
      updateFailed: 'Не вдалося оновити планування нагадувань.',
    },
    api: {
      backendNotConfigured: 'Backend API не налаштовано.',
      backendContactFailed: 'Щось пішло не так під час зв’язку з backend.',
      saveSummaryNotConfigured:
        'Збереження підсумків зустрічей у backend не налаштовано.',
      signInFailed: 'Щось пішло не так під час входу.',
      signUpFailed: 'Щось пішло не так під час створення акаунта.',
    },
    sync: {
      backendUnavailable:
        'Backend API не налаштовано. Локальні дані залишаються збереженими на цьому пристрої.',
    },
  },
  es: {
    app: {
      name: 'Weekly Us',
      navigationLabel: 'Navegación principal',
      openSettings: 'Abrir ajustes',
      householdMembers: 'Miembros del hogar',
      storageAttention: 'Algunos datos guardados necesitan atención',
      dismiss: 'Cerrar',
      routeTitles: {
        home: 'Weekly Us',
        meeting: 'Ritual semanal',
        meetingTemplates: 'Elegir una plantilla',
        tasks: 'Tareas del hogar',
        history: 'Historial',
        settings: 'Ajustes',
        upgrade: 'Premium',
        privateNotes: 'Notas privadas',
        calendarSync: 'Sincronización de calendario',
        workspaceSettings: 'Hogar',
        account: 'Cuenta',
        meetingDetails: 'Resumen de la reunión',
        meetingSummary: 'Resumen de la reunión',
      },
      nav: {
        home: 'Inicio',
        meeting: 'Reunión',
        tasks: 'Tareas',
        history: 'Historial',
        settings: 'Ajustes',
      },
    },
    common: {
      add: 'Agregar',
      available: 'Disponible',
      back: 'Atrás',
      close: 'Cerrar',
      copy: 'Copiar',
      dismiss: 'Cerrar',
      done: 'Listo',
      draft: 'Borrador',
      due: 'Vence',
      enable: 'Activar',
      exit: 'Salir',
      export: 'Exportar',
      finish: 'Finalizar',
      finished: 'Finalizada',
      locked: 'Bloqueado',
      markdown: 'Markdown',
      next: 'Siguiente',
      noneRecorded: 'Nada registrado.',
      open: 'Abrir',
      pdf: 'PDF',
      remove: 'Quitar',
      resume: 'Continuar',
      save: 'Guardar',
      shareOrSave: 'Compartir o guardar',
      skipped: 'Omitido',
      status: 'Estado',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      edit: 'Editar',
      email: 'Correo electrónico',
      password: 'Contraseña',
      displayName: 'Nombre visible',
      free: 'Gratis',
      notAvailable: 'No disponible',
      restorePurchases: 'Restaurar compras',
      manageSubscription: 'Administrar suscripción',
      goBack: 'Volver',
      localUser: 'Usuario local',
      weeklyUsUser: 'Usuario de Weekly Us',
    },
    localization: {
      title: 'Idioma',
      description:
        'Elige el idioma de los controles de la app y del texto del sistema en este dispositivo.',
      label: 'Idioma de la app',
    },
    account: {
      kicker: 'Cuenta',
      title: 'Ajustes de la cuenta',
      intro:
        'Administra el modelo de cuenta del frontend usado para sincronización, acceso Premium y futuras funciones de espacio familiar.',
      signedInAs: 'Sesión iniciada como',
      plan: 'Plan',
      created: 'Creada',
      subscription: 'Suscripción',
      currentPlan:
        'Plan actual: {plan}. El acceso Premium se basa en el derecho de suscripción, no solo en el estado de la cuenta.',
      renewal: 'Renovación',
      renewalUnavailable:
        'No disponible hasta que se agregue la facturación móvil real.',
      manageSubscription: 'Administrar suscripción',
      manageAvailable: 'Disponible a través de la tienda.',
      manageUnavailable:
        'Solo marcador de posición. No hay proveedor de pagos conectado.',
      viewPremium: 'Ver Premium',
      restorePurchases: 'Restaurar compras',
      profile: 'Perfil',
      profileHelp: 'En este MVP, solo la edición del nombre visible es local.',
      saveAccount: 'Guardar cuenta',
      session: 'Sesión',
      mockSession:
        'La autenticación simulada está activa. El token de acceso es un marcador de posición y no se guarda una contraseña real localmente.',
      apiSession:
        'Las solicitudes con sesión iniciada deben usar el token de acceso guardado a través de la capa de API.',
      logOut: 'Cerrar sesión',
      addDisplayName: 'Agrega un nombre visible.',
      updateFailed: 'No se pudo actualizar la cuenta.',
      updated: 'Cuenta actualizada en este dispositivo.',
    },
    auth: {
      signInKicker: 'Iniciar sesión',
      welcomeBack: 'Bienvenido de nuevo',
      signInIntro:
        'Continúa tu ritmo semanal del hogar y retoma donde te quedaste.',
      forgotPassword: '¿Olvidaste tu contraseña?',
      mockSignIn:
        'La autenticación simulada está activa. Cualquier correo y contraseña crearán una sesión temporal en el frontend.',
      signingIn: 'Iniciando sesión...',
      signIn: 'Iniciar sesión',
      newHere: '¿Nuevo en Weekly Us?',
      createAccount: 'Crear cuenta',
      createAccountIntro:
        'Configura un lugar compartido y tranquilo para revisiones semanales, acuerdos y seguimiento del hogar.',
      yourName: 'Tu nombre',
      passwordHelp: 'Al menos 8 caracteres',
      mockSignUp:
        'La autenticación simulada está activa. La contraseña se envía al servicio simulado y no se guarda localmente.',
      creating: 'Creando...',
      alreadyHaveAccount: '¿Ya tienes una cuenta?',
      passwordHelpKicker: 'Ayuda con la contraseña',
      resetPasswordTitle: 'Marcador de posición para restablecer contraseña.',
      resetPasswordIntro:
        'El correo del backend aún no está conectado. Esta pantalla mantiene listo el flujo de cuenta sin fingir que se envió un restablecimiento.',
      resetPlaceholder:
        'El restablecimiento de contraseña es un marcador de posición hasta que se conecte el correo del backend.',
      remembered: '¿La recordaste?',
      addAccountEmail: 'Agrega el correo electrónico de tu cuenta.',
      addEmail: 'Agrega una dirección de correo electrónico.',
      addPassword: 'Agrega tu contraseña.',
      passwordLength: 'Usa al menos 8 caracteres para la contraseña.',
      signInFailed: 'No se pudo iniciar sesión.',
      signUpFailed: 'No se pudo crear la cuenta.',
      continue: 'Continuar',
      emailPlaceholder: "tu{'@'}ejemplo.com",
    },
    welcome: {
      tagline: 'Una forma más tranquila de planear la semana juntos',
      intro:
        'Una reunión semanal guiada de 15 minutos para tareas compartidas, acuerdos prácticos y menos conversaciones repetidas del hogar.',
      benefitsLabel: 'Por qué crear una cuenta',
      syncLater: 'Sincronizar después',
      syncLaterText:
        'Prepárate para el acceso entre dispositivos cuando se conecte la sincronización del backend.',
      keepHistory: 'Guardar historial',
      keepHistoryText:
        'Conecta reuniones, acuerdos y seguimientos pendientes contigo.',
      premiumReady: 'Listo para Premium',
      premiumReadyText:
        'Usa el mismo modelo de cuenta para funciones pagas cuando se agreguen pagos.',
      mockAuth:
        'El inicio de sesión está simulado en esta versión. No se guarda una contraseña real localmente.',
      getStarted: 'Comenzar',
      continueLocal: 'Continuar solo en este dispositivo',
    },
    logout: {
      kicker: 'Cerrar sesión',
      title: '¿Cerrar sesión en Weekly Us?',
      accountFallback: 'esta cuenta',
      intro:
        'Saldrás de {email} en este dispositivo. Los datos locales de reuniones ya guardados en este teléfono no se eliminan.',
      help: 'Puedes continuar solo localmente después de cerrar sesión o volver a iniciar sesión desde la pantalla de bienvenida.',
      loggingOut: 'Cerrando sesión...',
      keepSignedIn: 'Mantener sesión iniciada',
    },
    home: {
      greeting: 'Buenos días,<br>{name}.',
      greetingPrefix: 'Buenos días,',
      householdFallback: 'tu hogar',
      heroTitle: '¿Listos para su reinicio semanal de 15 minutos?',
      heroText:
        'Tómense un momento para alinearse sobre la semana que viene, celebrar avances y conectarse.',
      startMeeting: 'Iniciar reunión',
      shortcutsLabel: 'Accesos rápidos de Weekly Us',
      tasksToReview: '{count} tareas para revisar',
      fromCheckIns: 'De revisiones semanales',
      meetingsSaved: '{count} reuniones guardadas',
      fullHistory: 'Historial completo disponible',
      freeLatest: 'Gratis abre las últimas {count}',
      unlockHistory: 'Desbloquear historial completo',
      unlockHistoryMessage:
        'Vuelve a revisiones semanales y acuerdos anteriores cuando tu hogar necesite contexto.',
    },
    history: {
      kicker: 'Historial de reuniones',
      title: 'Revisiones anteriores',
      intro:
        'Las reuniones finalizadas se guardan localmente. El historial gratis abre las últimas {count} reuniones finalizadas.',
      inProgress: 'En progreso',
      completedMeetings: 'Reuniones completadas',
      defaultMeetingTitle: 'Revisión familiar semanal',
      draftedToday: 'Borrador de hoy',
      draftedYesterday: 'Borrador de ayer',
      draftedDaysAgo: 'Borrador de hace {count} días',
      completedOn: 'Completada el {day}',
      noDrafts: 'No hay reunión en progreso.',
      unlockFullHistory: 'Desbloquear historial completo',
      unlockFullHistoryMessage:
        'Mirar atrás les ayuda a ver cuánto han avanzado juntos. Actualiza a Weekly Us Premium para ver todas las revisiones anteriores.',
      upgradePremium: 'Actualizar Premium',
      privateNotes: 'Notas privadas',
      privateNotesText:
        'Mantén las notas personales separadas del historial compartido de reuniones.',
      counts: '{notes} notas - {tasks} tareas - {agreements} acuerdos',
      deleteDraft: 'Eliminar borrador',
      confirmDeleteDraft:
        '¿Eliminar este borrador? Sus notas, tareas y acuerdos se quitarán.',
      draftDeleted: 'Borrador eliminado.',
      lockedTitle: 'Reunión anterior bloqueada',
      lockedMessage:
        'El historial gratis abre las últimas {count} reuniones finalizadas. Mejora para revisar esta reunión.',
      emptyTitle: 'Todavía no hay reuniones',
      emptyText: 'Las reuniones en borrador y finalizadas aparecerán aquí.',
    },
    meetingSummary: {
      title: 'Resumen de la reunión',
      mockTitle: 'Revisión familiar semanal',
      mockDate: '15 oct, 2023',
      mockAiInsight:
        'Una sesión productiva centrada en equilibrar la próxima semana escolar ocupada. El ánimo fue colaborativo y de apoyo, con todos de acuerdo en un plan claro de responsabilidades compartidas.',
      mockDecisionScreenTime:
        'Acordaron limitar el tiempo de pantalla a 1 hora en las noches entre semana para todos.',
      mockDecisionGroceries:
        'Sarah se encargará de comprar víveres este miércoles por la noche.',
      mockDecisionHiking:
        'El próximo fin de semana estará dedicado a una caminata familiar en el parque estatal.',
      mockActionFaucet: 'Arreglar la llave con fuga del baño de invitados',
      mockActionSoccer: 'Inscribirse en la liga de fútbol de otoño',
      aiInsight: 'Insight de AI',
      keyDecisions: 'Decisiones clave',
      actionItems: 'Acciones',
      sentiment: 'Sentimiento',
      overallMood: 'Ánimo general',
      positiveAligned: 'Positivo y alineado',
      sentimentStrength: 'Fuerza del ánimo',
      shareSummary: 'Compartir resumen',
      copied: 'Resumen copiado.',
      shared: 'Resumen compartido.',
      saved: 'Resumen guardado como archivo.',
      shareFailed: 'No se pudo compartir este resumen ahora.',
    },
    workspace: {
      title: 'Miembros del hogar',
      intro: 'Administra quién tiene acceso a tu espacio compartido.',
      currentMembersLabel: 'Miembros actuales',
      member: 'Miembro',
      viewer: 'Observador',
      admin: 'Administrador',
      removeMember: 'Quitar miembro',
      pendingInvites: 'Invitaciones pendientes',
      savedLocally: 'Guardado localmente',
      resend: 'Reenviar',
      inviteKept: 'La invitación se mantuvo localmente.',
      inviteNewMember: 'Invitar nuevo miembro',
      closeInviteForm: 'Cerrar formulario de invitación',
      goBack: 'Volver',
      addMember: 'Agregar miembro',
      contact: 'Correo electrónico o número de teléfono',
      contactPlaceholder: 'Ingresa correo electrónico o número de teléfono',
      role: 'Rol',
      inviteHelp:
        'Los miembros invitados recibirán un enlace para unirse al ritual semanal de tu hogar cuando se conecten las invitaciones del backend.',
      sendInvitation: 'Enviar invitación',
      ownerInviteOnly: 'Solo el propietario puede invitar miembros.',
      addContactFirst:
        'Primero agrega un correo electrónico o número de teléfono.',
      saveInviteFailed: 'No se pudo guardar esta invitación.',
      invitationSaved:
        'Invitación guardada localmente. No se ha enviado ningún correo en este MVP.',
      ownerRemoveOnly: 'Solo el propietario puede quitar miembros.',
      memberRemoved: 'Miembro eliminado del espacio de trabajo.',
    },
    privateNotes: {
      kicker: 'Notas privadas',
      title: 'Reflexiones personales',
      intro:
        'Mantén los pensamientos personales separados de las notas compartidas de reuniones, tareas y acuerdos.',
      storageLabel: 'Nota de almacenamiento de notas privadas',
      reflectionTitle: 'Para tu propia reflexión',
      storageText:
        'Las notas privadas se guardan en este dispositivo en el MVP actual.',
      editorHelp:
        'Estas notas quedan fuera de los resúmenes compartidos de reuniones y acuerdos.',
      premiumTitle: 'Las notas privadas son Premium',
      premiumMessage:
        'Mejora para mantener la preparación personal de reuniones y reflexiones separadas de los registros compartidos del hogar.',
      editTitle: 'Editar nota privada',
      createTitle: 'Crear nota privada',
      titleLabel: 'Título',
      titlePlaceholder: '¿De qué se trata?',
      noteLabel: 'Nota',
      notePlaceholder: 'Escribe lo que quieres recordar para ti.',
      relatedMeeting: 'Reunión relacionada',
      noMeetingLink: 'Sin enlace de reunión',
      saveChanges: 'Guardar cambios',
      saveNote: 'Guardar nota',
      savedTitle: 'Notas privadas guardadas',
      notesCount: '{count} notas personales en este dispositivo.',
      linkedTo: 'Vinculada a {meeting}',
      noNotes:
        'Todavía no hay notas privadas. Agrega una antes o después de una reunión.',
      addTitleAndNote: 'Agrega un título y una nota antes de guardar.',
      noteUpdated: 'Nota privada actualizada.',
      noteSaved: 'Nota privada guardada.',
      confirmDelete: '¿Eliminar esta nota privada?',
      noteDeleted: 'Nota privada eliminada.',
    },
    templatePage: {
      kicker: 'Plantillas de reunión',
      title: 'Elegir una revisión',
      intro:
        'Elige la agenda que encaje con esta semana. La revisión semanal predeterminada está incluida para todos.',
      continueDraft: 'Continuar reunión actual',
      sectionsLabel: 'Secciones de la reunión',
      upgradeToUse: 'Mejorar para usar',
      getPremium: 'Obtener Premium',
      startMeeting: 'Iniciar reunión',
    },
    calendar: {
      kicker: 'Sincronización de calendario',
      title: 'Google Calendar',
      intro:
        'Prepara reuniones semanales, fechas de tareas y seguimientos para sincronizarlos con el calendario.',
      placeholderTitle: 'Marcador de posición de conexión',
      placeholderText:
        'Google OAuth y el manejo de tokens deben estar respaldados por backend o usar un flujo seguro recomendado antes de habilitar la sincronización real.',
      premiumTitle: 'La sincronización con Google Calendar es Premium',
      premiumMessage:
        'Mejora para preparar reuniones de Weekly Us, fechas de tareas y seguimientos para Google Calendar.',
      connectionTitle: 'Conexión de Google Calendar',
      checkingConnection: 'Revisando la conexión de Google Calendar.',
      notConnected: 'Google Calendar no está conectado.',
      preparingConnection: 'Preparando conexión',
      connect: 'Conectar Google Calendar',
      disconnect: 'Desconectar',
      noTokens: 'No se guardan tokens de Google en esta app móvil.',
      optionsTitle: 'Opciones de sincronización',
      optionsText:
        'Elige qué debe sincronizar Weekly Us cuando Google Calendar esté listo.',
      options: {
        weeklyMeeting: {
          label: 'Agregar recordatorio de reunión semanal al calendario',
          description:
            'Crear un evento de calendario para la revisión del hogar.',
        },
        taskDueDates: {
          label: 'Agregar fechas de vencimiento de tareas al calendario',
          description:
            'Usa las fechas de vencimiento de tareas que necesitan seguimiento claro.',
        },
        followUpDates: {
          label: 'Agregar fechas de seguimiento al calendario',
          description:
            'Mantén visibles las fechas acordadas de revisión entre reuniones.',
        },
      },
      setupRequired:
        'La conexión con Google Calendar está preparada, pero OAuth seguro aún no está configurado.',
      addMeetingDate:
        'Agrega una fecha de reunión antes de sincronizar un recordatorio del calendario.',
      addTaskDueDate:
        'Agrega una fecha de vencimiento de la tarea antes de sincronizarla con Google Calendar.',
      addFollowUpDate:
        'Agrega una fecha de seguimiento antes de sincronizarla con Google Calendar.',
      oauthWaiting:
        'La sincronización de calendario está esperando un flujo seguro de conexión con Google.',
      checkFailed: 'Algo salió mal al revisar la sincronización de calendario.',
      startFailed: 'Algo salió mal al iniciar la sincronización de calendario.',
      disconnectFailed:
        'Algo salió mal al desconectar la sincronización de calendario.',
    },
    upgrade: {
      kicker: 'Premium',
      title: 'Mejorar Weekly Us',
      intro:
        'Premium es para hogares que quieren una memoria más larga, seguimiento suave y resúmenes claros después de cada revisión semanal.',
      heroTitle: 'Haz que el ritual semanal sea más fácil de revisar',
      heroText:
        'Desbloquea agregados prácticos sin convertir Weekly Us en un gestor de tareas o una app de presupuesto.',
      placeholdersTitle: 'Marcadores de posición de planes',
      placeholdersText:
        'Los precios y la facturación se conectarán más adelante mediante el flujo correcto de suscripciones móviles.',
      planOptionsLabel: 'Opciones de plan Premium',
      premiumActive: 'Premium activo',
      startMockPremium: 'Iniciar Premium simulado',
      comparisonTitle: 'Comparación de planes',
      comparisonText:
        'Sin presión. Gratis mantiene disponible el flujo principal de reunión semanal.',
      statusTitle: 'Estado de suscripción',
      currentPlan: 'Plan actual: {plan}',
      renewal: 'Renovación',
      manageSubscription: 'Administrar suscripción',
      account: 'Cuenta',
      renewalUnavailable:
        'No disponible hasta que se conecte la facturación real.',
      manageAvailable: 'Disponible a través de la tienda.',
      manageUnavailable:
        'La administración de facturación móvil se agregará más adelante.',
      billingNote:
        'Este muro de pago usa solo un proveedor de facturación simulado. La facturación móvil real debe validar derechos mediante un proveedor confiable o backend antes de desbloquear Premium en producción.',
      localDeviceMode: 'Modo local del dispositivo',
      storeBillingNotConnected:
        'La facturación de la tienda no está conectada en esta versión.',
      mockPurchasesDisabled:
        'Las compras simuladas están desactivadas en versiones de producción.',
      planUnavailable: 'Este plan Premium no está disponible.',
      mockPremiumEnabled: 'Premium simulado está activado en este dispositivo.',
      mockPremiumRestored: 'Premium simulado se restauró en este dispositivo.',
      noMockPremium:
        'No se encontró ninguna compra Premium simulada en este dispositivo.',
      managementLater:
        'La administración de suscripción abrirá Google Play o los ajustes de App Store después de configurar la facturación real.',
      checkFailed: 'Algo salió mal al revisar el acceso Premium.',
      startFailed: 'Algo salió mal al iniciar Premium.',
      restoreFailed: 'Algo salió mal al restaurar compras.',
      manageFailed: 'Algo salió mal al abrir la administración de suscripción.',
      plans: {
        premiumMonthly: {
          name: 'Mensual',
          priceLabel: 'Precio pendiente',
          description:
            'Una opción Premium flexible para el muro de pago simulado.',
        },
        premiumYearly: {
          name: 'Anual',
          priceLabel: 'Precio pendiente',
          description:
            'Una opción Premium anual para el muro de pago simulado.',
        },
      },
    },
    settings: {
      kicker: 'Ajustes',
      title: 'Configuración del hogar',
      intro:
        'Administra la lista local de personas usada para notas, tareas y acuerdos.',
      account: 'Cuenta',
      signedInAs: 'Sesión iniciada como {email}.',
      signedInFallback: 'tu cuenta',
      localOnly: 'Usando Weekly Us solo en este dispositivo.',
      noAccount: 'Todavía no hay una cuenta conectada.',
      accountSettings: 'Ajustes de la cuenta',
      accountOptions: 'Opciones de cuenta',
      workspaceSettings: 'Ajustes del espacio de trabajo',
      calendarSync: 'Sincronización de calendario',
      legal: 'Legal',
      legalText:
        'Documentos de marcador de posición para pruebas internas. Revísalos antes del lanzamiento público.',
      privacyPolicy: 'Política de privacidad',
      terms: 'Términos',
      reminders: 'Recordatorios',
      reminderPremiumTitle: 'Los ajustes de recordatorios son Premium',
      reminderPremiumMessage:
        'Mejora para programar recordatorios locales suaves de reuniones semanales y seguimientos pendientes del hogar.',
      reminderIntro:
        'Weekly Us puede usar notificaciones locales del dispositivo para tu reunión y seguimientos pendientes. No se usan notificaciones push ni configuración de cuenta.',
      enableReminders: 'Activar recordatorios',
      weeklyMeetingReminder: 'Recordatorio de reunión semanal',
      unfinishedTaskReminder: 'Recordatorio de tarea pendiente',
      day: 'Día',
      time: 'Hora',
      reminderExample:
        'Ejemplo: Un recordatorio suave para revisar acuerdos pendientes.',
      reminderLocked:
        'Los ajustes de recordatorios están disponibles con Premium.',
      remindersOff: 'Los recordatorios están desactivados.',
      notificationsUnavailable:
        'Las notificaciones locales están disponibles en la app de Android. El modo web de desarrollo guarda estos ajustes sin programar notificaciones.',
      notificationsBlocked:
        'Las notificaciones están bloqueadas en los ajustes del sistema.',
      remindersScheduled:
        'Los recordatorios están programados en este dispositivo.',
      remindersSaved:
        'Los recordatorios están guardados y se programarán cuando las notificaciones estén disponibles.',
      participants: 'Participantes',
      participantsIntro:
        'Por ahora se guardan en este dispositivo. Sin cuentas ni invitaciones todavía.',
      name: 'Nombre',
      initials: 'Iniciales',
      auto: 'Auto',
      type: 'Tipo',
      avatarColor: 'Color de avatar',
      color: 'Color',
      addParticipant: 'Agregar participante',
      addNameFirst: 'Primero agrega un nombre.',
      participantAdded: 'Participante agregado.',
      participantUpdated: 'Participante actualizado.',
      participantEnabled: 'Participante activado.',
      participantDisabled:
        'Participante desactivado. Los registros existentes conservan su nombre.',
      participantRemoved: 'Participante sin uso eliminado.',
      disable: 'Desactivar',
      role: {
        owner: 'Propietario',
        adultMember: 'Miembro adulto',
        viewer: 'Observador',
      },
      participantType: {
        adult: 'Adulto',
        child: 'Niño',
        other: 'Otro',
      },
      defaultParticipant: {
        me: 'Yo',
        partner: 'Pareja',
      },
      defaultWorkspace: 'Nuestro espacio semanal',
      mockWorkspaceRole: 'Rol simulado del espacio',
      premiumFeatureChecks: 'Comprobaciones de funciones Premium',
    },
    tasksPage: {
      kicker: 'Tareas',
      title: 'Lo que acordamos hacer',
      intro:
        'Un lugar ligero para los seguimientos del hogar que salen de tus reuniones semanales.',
      openTasks: 'Tareas abiertas',
      stillRelevantCount: '{count} aún relevantes',
      readOnlyTasks:
        'Este rol del espacio puede ver tareas, pero no editarlas.',
      task: 'Tarea',
      responsible: 'Responsable',
      needsDiscussion: 'Necesita conversación',
      shared: 'Compartida',
      disabledParticipant: ' (desactivado)',
      stillRelevant: '¿Sigue siendo relevante?',
      fromMeeting: 'De {meeting}',
      skip: 'Omitir',
      doneTasks: 'Tareas hechas ({count})',
      skippedTasks: 'Tareas omitidas ({count})',
      reopen: 'Reabrir',
      bringBack: 'Recuperar',
      noOpenTasks: 'No hay tareas abiertas ahora.',
      nothingDone: 'Todavía no hay nada marcado como hecho.',
      noSkippedTasks: 'No hay tareas omitidas.',
      recentAgreements: 'Acuerdos recientes',
      agreementsIntro: 'Decisiones guardadas de reuniones semanales.',
      noAgreements: 'Todavía no hay acuerdos guardados.',
      agreement: 'Acuerdo',
      date: 'Fecha',
      meeting: 'Reunión',
      people: 'Personas',
      relatedTasks: 'Tareas relacionadas',
      addShortTitle: 'Primero agrega un título corto.',
      taskUpdated: 'Tarea actualizada.',
      markedDone: 'Marcada como hecha.',
      updated: 'Actualizado.',
      ownerDeleteOnly: 'Solo el propietario puede eliminar tareas.',
      confirmDeleteTask: '¿Eliminar esta tarea?',
      taskDeleted: 'Tarea eliminada.',
    },
    legal: {
      backToSettings: 'Volver a ajustes',
      privacy: {
        kicker: 'Política de privacidad',
        title: 'Privacidad de Weekly Us',
        intro:
          'Marcador de posición para pruebas internas. Reemplázalo con una política revisada antes de cualquier lanzamiento público en Google Play.',
        dataTitle: 'Modelo de datos actual del MVP',
        dataText:
          'Weekly Us guarda notas de reuniones, tareas, acuerdos, participantes, notas privadas, ajustes y estado Premium simulado localmente en este dispositivo. No hay sincronización con backend conectada en el MVP actual.',
        privateNotesTitle: 'Notas privadas',
        privateNotesText:
          'Las notas privadas se guardan en este dispositivo en el MVP actual. No se incluyen en las exportaciones de reuniones de forma predeterminada.',
        aiTitle: 'Marcadores de posición de AI y Premium',
        aiText:
          'Los resúmenes de AI usan un proveedor simulado local a menos que se active explícitamente una API backend. Los resúmenes de AI pueden ser inexactos. Revísalos antes de confiar en ellos.',
        premiumText:
          'Las pantallas Premium y de facturación usan estado de suscripción simulado solo para pruebas internas. Los pagos reales no están conectados.',
      },
      terms: {
        kicker: 'Términos',
        title: 'Términos de Weekly Us',
        intro:
          'Marcador de posición para pruebas internas. Reemplázalo con términos revisados antes de cualquier lanzamiento público en Google Play.',
        testingTitle: 'Solo para pruebas internas',
        testingText:
          'Esta versión está preparada para pruebas internas. No está lista para distribución pública, suscripciones pagas, sincronización backend ni soporte de producción.',
        adviceTitle: 'No es asesoría profesional',
        adviceText:
          'Weekly Us es una herramienta práctica de revisión del hogar. No es terapia, asesoría legal, asesoría financiera ni soporte de emergencia.',
        localDataTitle: 'Responsabilidad sobre datos locales',
        localDataText:
          'Los datos se guardan localmente en este dispositivo en el MVP actual. Las personas usuarias deben revisar acuerdos importantes antes de confiar en ellos y entender que desinstalar la app o borrar el almacenamiento puede eliminar datos locales.',
      },
    },
    days: {
      sunday: 'Domingo',
      monday: 'Lunes',
      tuesday: 'Martes',
      wednesday: 'Miércoles',
      thursday: 'Jueves',
      friday: 'Viernes',
      saturday: 'Sábado',
    },
    meeting: {
      closeMeeting: 'Cerrar reunión',
      stepOf: 'Paso {current} de {total}',
      saveDraft: 'Guardar borrador',
      menu: {
        label: 'Menú del ritual',
        open: 'Abrir menú del ritual',
        pauseRitual: 'Pausar ritual',
        resumeRitual: 'Reanudar ritual',
        saveDraftExit: 'Guardar borrador y salir',
        endSession: 'Finalizar sesión',
        deleteRitual: 'Eliminar ritual',
      },
      notes: 'Notas',
      author: 'Autor',
      note: 'Nota',
      addNote: 'Agregar nota',
      noNotesYet: 'Todavía no hay notas.',
      noNotesInSection: 'No hay notas en esta sección.',
      tasks: 'Tareas',
      taskTitle: 'Título de la tarea',
      optionalDetail: 'Detalle opcional',
      responsible: 'Responsable',
      dueDate: 'Fecha de vencimiento',
      addTask: 'Agregar tarea',
      noTasksYet: 'Todavía no hay tareas.',
      noTasksInSection: 'No hay tareas en esta sección.',
      agreements: 'Acuerdos',
      decisionOrAgreement: 'Decisión o acuerdo',
      participants: 'Participantes',
      addAgreement: 'Agregar acuerdo',
      noAgreementsYet: 'Todavía no hay acuerdos.',
      noAgreementsInSection: 'No hay acuerdos en esta sección.',
      reviewTogether: 'Revisar juntos',
      reviewIntro: 'Revisen las notas, tareas y acuerdos antes de finalizar.',
      atLeastOne:
        'Agrega al menos una nota, tarea o acuerdo antes de finalizar.',
      tasksAndResponsibilities: 'Tareas y responsabilidades',
      finished: 'Esta reunión está finalizada.',
      newMeeting: 'Nueva reunión',
      weeklyMeeting: 'Reunión semanal',
      readOnlyTitle: 'Acceso de solo lectura',
      readOnlyText:
        'Los observadores pueden ver resúmenes y tareas compartidas, pero no pueden iniciar ni editar una reunión semanal.',
      viewHistory: 'Ver historial',
      formerParticipant: 'Participante anterior',
      someone: 'Alguien',
      shared: 'Compartida',
      needsDiscussion: 'Necesita conversación',
      unassigned: 'Sin asignar',
      recentMeeting: 'Reunión reciente',
      fromMeeting: 'De {title} - {date}',
      unfinishedTitle: '¿Qué hacemos con las tareas pendientes?',
      stillRelevant: '¿Sigue siendo relevante? {date}',
      unfinishedChoices: 'Opciones para tareas pendientes',
      keep: 'Mantener',
      markDone: 'Marcar como hecha',
      skip: 'Omitir',
      moveToThisWeek: 'Mover a esta semana',
      noContentPreview: 'Todavía no hay notas, tareas ni acuerdos.',
      meetingNotFound: 'Reunión no encontrada',
      notSaved: 'Esta reunión no está guardada en este dispositivo.',
      backToHistory: 'Volver al historial',
      olderMeetingLocked: 'Reunión anterior bloqueada',
      freeHistoryLimit:
        'El historial gratis abre las últimas {count} reuniones finalizadas. Mejora para revisar cada sección, nota, tarea y acuerdo.',
      exportPremiumTitle: 'Exportar es Premium',
      exportPremiumMessage:
        'Mejora para exportar resúmenes de reuniones, acuerdos y tareas.',
      exportMeeting: 'Exportar reunión',
      exportHelp:
        'Guarda una copia clara del resumen, notas, tareas y acuerdos. Las notas privadas no se incluyen.',
      aiPremiumTitle: 'Los resúmenes de AI son Premium',
      aiPremiumMessage:
        'Mejora para generar resúmenes neutrales de reuniones y próximos pasos.',
      aiSummary: 'Resumen de AI',
      aiDisclaimer:
        'Los resúmenes de AI pueden ser inexactos. Revísalos antes de confiar en ellos. Esto no es asesoría profesional de relaciones.',
      generate: 'Generar',
      regenerate: 'Generar de nuevo',
      generateSummary: '{action} resumen',
      mainTopics: 'Temas principales conversados',
      keyTensions: 'Tensiones clave',
      agreementsMade: 'Acuerdos alcanzados',
      openTasks: 'Tareas abiertas',
      noOpenTasksSummarized: 'No se resumieron tareas abiertas.',
      revisitNextWeek: 'Temas para revisar la próxima semana',
      generateEmpty:
        'Genera un resumen neutral de la reunión, los acuerdos y los próximos pasos.',
      exportChoose:
        'Elige un formato simple. Las notas privadas no se incluyen.',
      format: 'Formato',
      plainText: 'Texto simple',
      plainTextHelp: 'Ideal para copiar en mensajes o notas.',
      markdownHelp: 'Encabezados y listas limpios para documentos.',
      copied: 'Exportación copiada al portapapeles.',
      sharedExport: 'Exportación compartida.',
      savedExport: 'Exportación guardada como archivo.',
      copyFailed:
        'No se pudo copiar esta exportación. Intenta compartirla o guardarla.',
      shareFailed: 'No se pudo compartir o guardar esta exportación ahora.',
      printOpened:
        'Se abrió la vista de impresión. Elige Guardar como PDF si está disponible.',
      printFailed:
        'No se pudo abrir la vista de impresión PDF en este dispositivo.',
      generateFailed: 'No se pudo generar un resumen ahora.',
      notePlaceholders: {
        goodThings: 'Algo que aprecié fue...',
        tensions: 'Noté que esto se sintió difícil porque...',
        tasks: 'Un detalle útil para esta semana es...',
        money: 'Algo que comprar o decidir sobre dinero es...',
        familyCare: 'Una nota de cuidado familiar para recordar es...',
        plans: 'Algo que viene la próxima semana es...',
        finalAgreements: 'Una decisión que queremos mantener es...',
        default: 'Agrega una nota práctica corta...',
      },
      taskTitlePlaceholder: '¿Qué necesita atención?',
      taskDetailPlaceholder: '¿Algo que haría esto más fácil?',
      agreementPlaceholder: '¿Qué acordamos?',
      neutralHint:
        'Intenta nombrar lo que pasó y lo que ayudaría, sin etiquetas ni culpas.',
      roleCannotEditMeetings:
        'Este rol del espacio puede ver reuniones, pero no editarlas.',
      roleCannotEditTasks:
        'Este rol del espacio puede ver tareas, pero no editarlas.',
      roleCannotEditAgreements:
        'Este rol del espacio puede ver acuerdos, pero no editarlos.',
      addNameFirst: 'Primero agrega un nombre.',
      guestLimitReached: 'Hasta {count} personas pueden unirse a esta reunión.',
      personAdded: 'Persona agregada.',
      noteAdded: 'Nota agregada.',
      taskAdded: 'Tarea agregada.',
      agreementAdded: 'Acuerdo agregado.',
      keptForNow: 'Se mantiene por ahora.',
      markedDone: 'Marcada como hecha.',
      skippedForNow: 'Omitida por ahora.',
      movedToThisWeek: 'Movida a esta semana.',
      draftSaved: 'Borrador guardado en este teléfono.',
      meetingFinished: 'Reunión finalizada.',
      ritualPaused: 'Ritual pausado.',
      ritualResumed: 'Ritual reanudado.',
      pauseRitualFailed: 'No se pudo pausar este ritual.',
      resumeRitualFailed: 'No se pudo reanudar este ritual.',
      confirmEndSessionTitle: '¿Finalizar esta sesión?',
      confirmEndSessionText: 'Tu progreso se guardará como incompleto.',
      endSessionFailed: 'No se pudo finalizar esta sesión.',
      confirmDeleteRitualTitle: '¿Eliminar este ritual?',
      confirmDeleteRitualText: 'Esta acción no se puede deshacer.',
      ritualDeleted: 'Ritual eliminado.',
      deleteRitualFailed: 'No se pudo eliminar este ritual.',
      taskStatus: {
        open: 'Abierta',
        done: 'Hecha',
        skipped: 'Omitida',
      },
    },
    meetingStore: {
      openBeforeNote: 'Abre una reunión antes de agregar una nota.',
      addShortNote: 'Primero agrega una nota corta.',
      chooseNoteAuthor: 'Elige quién agrega esta nota.',
      openBeforeTask: 'Abre una reunión antes de agregar una tarea.',
      taskTitleRequired: 'El título de la tarea es obligatorio.',
      chooseResponsible:
        'Elige una persona responsable o márcala para conversar.',
      chooseFromMeeting: 'Elige a alguien de esta reunión.',
      openBeforeAgreement: 'Abre una reunión antes de agregar un acuerdo.',
      addAgreementFirst: 'Primero agrega el acuerdo.',
      chooseAgreementPeople: 'Elige a quiénes incluye este acuerdo.',
      choosePeopleFromMeeting: 'Elige personas de esta reunión.',
      openBeforeFinish: 'Abre una reunión antes de finalizar.',
    },
    templates: {
      weeklyFamilyCheckIn: {
        name: 'Revisión familiar semanal',
        description: 'El ritmo semanal estándar para notas, tareas y acuerdos.',
      },
      coupleReset: {
        name: 'Reinicio de pareja',
        description:
          'Un reinicio práctico y breve para parejas después de una semana llena.',
      },
      familyWithKids: {
        name: 'Familia con hijos',
        description:
          'Una revisión enfocada en rutinas, cuidados y logística de niños.',
      },
      moneyCheckIn: {
        name: 'Revisión de dinero',
        description:
          'Una agenda sencilla para gastos del hogar y decisiones de dinero.',
      },
      conflictCleanup: {
        name: 'Ordenar un conflicto',
        description:
          'Una forma tranquila de convertir un asunto pendiente en próximos pasos.',
      },
      busyWeekPlanning: {
        name: 'Planificación de semana ocupada',
        description:
          'Un plan práctico para horarios, mandados y opciones de respaldo.',
      },
      sections: {
        goodThings: {
          title: 'Cosas buenas',
          prompt: '¿Qué salió bien esta semana?',
        },
        tensions: {
          title: 'Tensiones',
          prompt: '¿Qué se sintió estresante, injusto o pendiente?',
        },
        tasks: {
          title: 'Tareas',
          prompt: '¿Qué hay que atender esta semana?',
        },
        money: {
          title: 'Dinero / compras',
          prompt: '¿Qué deberíamos comprar, pausar o decidir sobre dinero?',
        },
        familyCare: {
          title: 'Niños / cuidado familiar',
          prompt:
            '¿Qué necesita atención en rutinas, cuidados o necesidades familiares?',
        },
        plans: {
          title: 'Planes',
          prompt: '¿Qué viene la próxima semana?',
        },
        finalAgreements: {
          title: 'Acuerdos finales',
          prompt: '¿Qué deberíamos acordar antes de terminar?',
        },
        appreciation: {
          title: 'Agradecimiento',
          prompt: '¿Qué apreciaste esta semana?',
        },
        frustrations: {
          title: 'Frustraciones',
          prompt: '¿Qué se sintió frustrante o difícil de cargar?',
        },
        emotionalLoad: {
          title: 'Carga emocional',
          prompt: '¿Qué se sintió mental o emocionalmente pesado esta semana?',
        },
        timeTogether: {
          title: 'Tiempo juntos',
          prompt: '¿Qué tiempo juntos ayudaría esta semana?',
        },
        practicalAgreements: {
          title: 'Acuerdos prácticos',
          prompt:
            '¿Qué debería quedar claro antes de que empiece la próxima semana?',
        },
        childRoutines: {
          title: 'Rutinas de los niños',
          prompt: '¿Qué rutinas necesitan atención esta semana?',
        },
        school: {
          title: 'Escuela / jardín de niños',
          prompt: '¿Qué deberíamos recordar para la escuela o jardín de niños?',
        },
        health: {
          title: 'Salud',
          prompt: '¿Hay necesidades de salud, citas o detalles de cuidado?',
        },
        activities: {
          title: 'Actividades',
          prompt: '¿Qué actividades necesitan planificación o apoyo?',
        },
        parentResponsibilities: {
          title: 'Responsabilidades de crianza',
          prompt: '¿Quién se encargará de qué esta semana?',
        },
        purchases: {
          title: 'Compras',
          prompt: '¿Qué hay que comprar, reemplazar o decidir?',
        },
        upcomingExpenses: {
          title: 'Gastos próximos',
          prompt: '¿Qué gastos vienen pronto?',
        },
        subscriptionsBills: {
          title: 'Suscripciones / cuentas',
          prompt: '¿Qué cuentas o suscripciones deberíamos revisar?',
        },
        savingGoals: {
          title: 'Metas de ahorro',
          prompt: '¿Qué meta de ahorro necesita atención?',
        },
        financialConcerns: {
          title: 'Preocupaciones financieras',
          prompt: '¿Qué preocupación de dinero deberíamos nombrar claramente?',
        },
        decisions: {
          title: 'Decisiones',
          prompt: '¿Qué decidimos?',
        },
        whatHappened: {
          title: 'Qué pasó',
          prompt: '¿Qué pasó, en palabras simples?',
        },
        personNeeds: {
          title: 'Qué necesita cada persona',
          prompt: '¿Qué necesita cada persona ahora?',
        },
        whatShouldChange: {
          title: 'Qué debería cambiar',
          prompt: '¿Qué haría que esto sea menos probable la próxima vez?',
        },
        concreteNextStep: {
          title: 'Siguiente paso concreto',
          prompt: '¿Cuál es la siguiente acción clara?',
        },
        followUpDate: {
          title: 'Fecha de seguimiento',
          prompt: '¿Cuándo deberíamos volver a revisar esto?',
        },
        scheduleOverview: {
          title: 'Vista general del horario',
          prompt: '¿Cómo se ve la semana?',
        },
        meals: {
          title: 'Comidas',
          prompt:
            '¿Qué comidas o decisiones de comida harían la semana más fácil?',
        },
        childcare: {
          title: 'Cuidado de niños',
          prompt: '¿Qué cuidado de niños hay que cubrir?',
        },
        shopping: {
          title: 'Compras',
          prompt: '¿Qué compras hay que hacer?',
        },
        adminTasks: {
          title: 'Tareas administrativas',
          prompt: '¿Qué tareas administrativas no deberían olvidarse?',
        },
        backupPlans: {
          title: 'Planes de respaldo',
          prompt: '¿Cuál es el plan de respaldo si la semana cambia?',
        },
      },
    },
    premium: {
      badge: 'Premium',
      feature: 'Función Premium',
      title: '{feature} es Premium',
      message: 'Mejora tu plan para usar esta función.',
      viewPremium: 'Ver Premium',
      locked: 'Función Premium bloqueada',
      unlock: 'Desbloquear',
    },
    features: {
      basicMeetings: {
        label: 'Reuniones semanales básicas',
        description: 'Crea y realiza una reunión familiar semanal sencilla.',
      },
      defaultTemplate: {
        label: 'Plantilla de reunión predeterminada',
        description: 'Usa la agenda estándar de reunión de Weekly Us.',
      },
      tasksAndAgreements: {
        label: 'Tareas y acuerdos',
        description: 'Crea tareas del hogar y acuerdos de reuniones.',
      },
      manualResponsibility: {
        label: 'Asignación manual de responsabilidad',
        description:
          'Asigna tareas y acuerdos manualmente a miembros de la familia.',
      },
      limitedHistory: {
        label: 'Historial reciente de reuniones',
        description: 'Revisa las últimas 3 reuniones completadas.',
      },
      localReminders: {
        label: 'Recordatorios locales',
        description:
          'Usa recordatorios simples del dispositivo cuando estén disponibles.',
        lockedReason:
          'Mejora para programar recordatorios locales en este dispositivo.',
      },
      unlimitedHistory: {
        label: 'Historial ilimitado de reuniones',
        description: 'Conserva y revisa todas las reuniones completadas.',
        lockedReason:
          'Mejora para conservar el registro completo de tus reuniones familiares.',
      },
      aiSummary: {
        label: 'Resúmenes de reuniones con AI',
        description:
          'Convierte notas de reunión en un resumen claro y próximos pasos.',
        lockedReason:
          'Mejora para generar resúmenes de reuniones automáticamente.',
      },
      agreementReminders: {
        label: 'Recordatorios de acuerdos pendientes',
        description:
          'Recibe recordatorios de acuerdos que aún necesitan seguimiento.',
        lockedReason:
          'Mejora para mantener visibles los acuerdos pendientes entre reuniones.',
      },
      additionalTemplates: {
        label: 'Plantillas de reunión adicionales',
        description:
          'Usa plantillas para distintas situaciones familiares y del hogar.',
        lockedReason: 'Mejora para elegir más formatos de reunión.',
      },
      privateNotes: {
        label: 'Notas privadas',
        description:
          'Mantén notas personales separadas de las notas compartidas.',
        lockedReason:
          'Mejora para agregar notas privadas a tu preparación de reuniones.',
      },
      googleCalendarSync: {
        label: 'Sincronización con Google Calendar',
        description: 'Sincroniza reuniones y seguimientos con Google Calendar.',
        lockedReason: 'Mejora para conectar Weekly Us con Google Calendar.',
      },
      export: {
        label: 'Exportar',
        description: 'Exporta reuniones como PDF, texto o Markdown.',
        lockedReason: 'Mejora para exportar notas y acuerdos de reuniones.',
      },
      advancedStatistics: {
        label: 'Estadísticas avanzadas',
        description: 'Observa patrones del hogar más profundos con el tiempo.',
        lockedReason:
          'Mejora para desbloquear información avanzada del hogar cuando esté disponible.',
      },
    },
    reminders: {
      title: 'Weekly Us',
      channelName: 'Recordatorios de Weekly Us',
      channelDescription:
        'Recordatorios amables para reuniones y elementos pendientes.',
      weeklyMeetingBody: 'Un recordatorio amable para tu reunión semanal.',
      unfinishedBoth:
        'Un recordatorio amable para revisar acuerdos y tareas pendientes.',
      unfinishedTasks: 'Un recordatorio amable para revisar tareas pendientes.',
      unfinishedAgreements:
        'Un recordatorio amable para revisar acuerdos pendientes.',
    },
    export: {
      meetingTitle: 'Reunión de Weekly Us',
      date: 'Fecha',
      status: 'Estado',
      finished: 'finalizada',
      draft: 'borrador',
      aiSummary: 'Resumen de AI',
      aiDisclaimer:
        'Los resúmenes de AI pueden ser inexactos. Revísalos antes de confiar en ellos.',
      mainTopics: 'Temas principales conversados',
      keyTensions: 'Tensiones clave',
      agreementsMade: 'Acuerdos alcanzados',
      openTasks: 'Tareas abiertas',
      revisitNextWeek: 'Temas para revisar la próxima semana',
      meetingSections: 'Secciones de la reunión',
      notes: 'Notas',
      tasks: 'Tareas',
      agreements: 'Acuerdos',
      noNotes: 'No hay notas en esta sección.',
      noTasks: 'No hay tareas en esta sección.',
      noAgreements: 'No hay acuerdos en esta sección.',
      noOpenTasks: 'No se resumieron tareas abiertas.',
      privateNotesExcluded:
        'Las notas privadas no se incluyen en esta exportación.',
      people: 'Personas',
      responsible: 'Responsable',
      needsDiscussion: 'Necesita conversación',
      shared: 'Compartida',
      unassigned: 'Sin asignar',
      due: 'Vence',
      noneRecorded: 'Nada registrado.',
      clipboardUnavailable:
        'El portapapeles no está disponible en este navegador.',
      taskStatus: {
        open: 'abierta',
        done: 'hecha',
        skipped: 'omitida',
      },
    },
    ai: {
      promptContract: [
        'Escribe un resumen breve y neutral.',
        'Enumera los temas principales conversados.',
        'Enumera los acuerdos alcanzados.',
        'Enumera las tareas abiertas y las personas responsables.',
        'Enumera los temas para revisar la próxima semana.',
        'Mantén un tono práctico y sin juicios.',
        'No actúes como terapeuta ni decidas quién tiene razón o culpa.',
        'No incluyas afirmaciones diagnósticas o psicológicas.',
      ],
      emptyTensions: 'No se registraron tensiones específicas en esta reunión.',
      emptyAgreements: 'No se registraron acuerdos en esta reunión.',
      emptyFocus:
        'Revisa las tareas abiertas, confirma cualquier acuerdo nuevo y vuelve a los temas que aún necesitan una decisión.',
      noTopics: 'No se registraron temas de reunión.',
      checkProgress: 'Revisar avance de "{title}".',
      shortSummary:
        'Esta reunión cubrió {topics}. Las notas muestran {agreementCount} {agreementWord} y {taskCount} {taskWord} para dar seguimiento.',
      agreementOne: 'acuerdo',
      agreementOther: 'acuerdos',
      taskOne: 'tarea',
      taskOther: 'tareas',
    },
    storage: {
      blocked:
        'Weekly Us no puede acceder al almacenamiento local del dispositivo. Puedes seguir usando esta sesión, pero es posible que los cambios no se conserven.',
      parseFailed:
        'No se pudieron leer algunos datos guardados de {label}. La app conservó la copia local original para recuperación e inició esa parte con valores seguros.',
      accessFailed:
        'No se pudo acceder a algunos datos guardados de {label}. La app inició esa parte con valores seguros.',
      newerVersion:
        'Los datos guardados fueron creados por una versión más nueva de Weekly Us. La app conservó una copia de respaldo e inició con valores locales seguros.',
      missingMigration:
        'Los datos guardados necesitan una migración que esta versión de la app aún no conoce. La app conservó una copia de respaldo e inició con valores locales seguros.',
      saveFailed:
        'Weekly Us no pudo guardar cambios locales en este dispositivo. El almacenamiento puede estar lleno o bloqueado. Tu sesión actual puede continuar, pero es posible que los cambios no se conserven.',
      appDataAccessFailed:
        'No se pudo acceder a los datos guardados de Weekly Us. La app inició con valores seguros para que puedas seguir usándola.',
      invalidData:
        'Los datos guardados de Weekly Us no tenían el formato esperado. Se conservó una copia local de respaldo y la app inició con valores seguros para que puedas seguir usándola.',
      corruptData:
        'No se pudieron leer los datos guardados de Weekly Us. Se conservó una copia local de respaldo y la app inició con valores seguros para que puedas seguir usándola.',
      backupFailed:
        'Weekly Us no pudo crear una copia local de respaldo porque el almacenamiento del dispositivo puede estar lleno o bloqueado.',
    },
    notifications: {
      unavailable: 'Las notificaciones no están disponibles en este entorno.',
      premiumOnly: 'La programación de recordatorios es una función Premium.',
      updateFailed: 'No se pudo actualizar la programación de recordatorios.',
    },
    api: {
      backendNotConfigured: 'La API del backend no está configurada.',
      backendContactFailed: 'Algo salió mal al contactar el backend.',
      saveSummaryNotConfigured:
        'Guardar resúmenes de reuniones en el backend no está configurado.',
      signInFailed: 'Algo salió mal al iniciar sesión.',
      signUpFailed: 'Algo salió mal al crear la cuenta.',
    },
    sync: {
      backendUnavailable:
        'La API del backend no está configurada. Los datos locales permanecen guardados en este dispositivo.',
    },
  },
} as const;

export type MessageSchema = typeof messages.en;
