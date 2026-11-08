// The feature articles: what each part of Balanced does, written as the
// public site's articles. The front page shows each one's teaser and links to
// its page at /features/<slug>. Plain data, so a later blog can reuse the same
// shape and the same article template.
//
// Every claim here is something the app does today. Pictures are plates
// (public/marketing/plates): crops of one region of a screen, legible at the
// size they are shown.

export type Picture = {
  src: string;
  // The plate's pixel size as a CSS aspect ratio, so it is shown uncropped.
  aspect: string;
  alt: string;
  caption?: string;
  // The same section as a phone renders it, shown in its place below 761px.
  phone?: { src: string; aspect: string };
};

export type ArticleSection = {
  heading: string;
  paragraphs: string[];
  picture?: Picture;
};

export type Article = {
  slug: string;
  // One word: the article's name in navigation and lists.
  name: string;
  headline: string;
  standfirst: string;
  // Two sentences for the front page and the features index.
  teaser: string;
  picture: Picture;
  sections: ArticleSection[];
  smallPrint: { key: string; text: string }[];
};

const plates = {
  transactions: {
    src: "/marketing/plates/transactions.png",
    aspect: "2464 / 1834",
    alt: "The transactions page: '8 transactions to approve', the write-a-line box, and ledger rows whose suggested categories sit in pencil beside an Approve button",
    phone: {
      src: "/marketing/plates/transactions-phone.png",
      aspect: "1170 / 957",
    },
  },
  budgetLead: {
    src: "/marketing/plates/budget-lead.png",
    aspect: "2464 / 1736",
    alt: "The budget page for a sample October: the headline 'Spending came in £570 under plan, led by Holidays', the left-over figure and notes on what ran over and what held",
    phone: {
      src: "/marketing/plates/budget-lead-phone.png",
      aspect: "1170 / 1536",
    },
  },
  budgetShare: {
    src: "/marketing/plates/budget-share.png",
    aspect: "2464 / 1376",
    alt: "The budget's expenses: Fixed, Variable and Discretionary rows with how far each landed from budget and its share of the month's spending as a bar",
    phone: {
      src: "/marketing/plates/budget-share-phone.png",
      aspect: "1170 / 1179",
    },
  },
  balance: {
    src: "/marketing/plates/balance.png",
    aspect: "2464 / 1798",
    alt: "The balance sheet: 'Net worth rose £4,551 to £348,326', the biggest gain and drop, and every asset with its move since September",
    phone: { src: "/marketing/plates/balance-phone.png", aspect: "1170 / 960" },
  },
  plan: {
    src: "/marketing/plates/plan.png",
    aspect: "2464 / 1190",
    alt: "The plan's net-worth forecast from age 44 to 95: assets stacked by kind, net worth rising to about £1m at retirement then holding, a widening band for how returns might vary, and the age the pots run out marked",
    phone: { src: "/marketing/plates/plan-phone.png", aspect: "1170 / 900" },
  },
  settings: {
    src: "/marketing/plates/settings.png",
    aspect: "1424 / 1612",
    alt: "Settings: currency and number format, the colour scheme, and the switches for transactions and transfers",
  },
  cashflow: {
    src: "/marketing/plates/cashflow.png",
    aspect: "2464 / 672",
    alt: "The dashboard's cash-flow chart for a sample year: income and expense bars for each month, a net line, and the share of income kept, with August dipping to £754 short",
    phone: {
      src: "/marketing/plates/cashflow-phone.png",
      aspect: "1170 / 1446",
    },
  },
} satisfies Record<string, Picture>;

const SAMPLE = "A sample month from the demo account.";

export const FEATURES: Article[] = [
  {
    slug: "transactions",
    name: "Transactions",
    headline: "A bank statement in, a sorted month out",
    standfirst:
      "Import a statement or write a line, then approve what Balanced Money has filed for you. A month takes a few minutes.",
    teaser:
      "Drop in a statement and each merchant is filed the way you filed it before, in pencil until you approve it. Paid cash? Write the line as you would jot it.",
    picture: plates.transactions,
    sections: [
      {
        heading: "Import a statement",
        paragraphs: [
          "Download a CSV from your bank and import it. Balanced Money works out which columns hold the date, the description and the amount, and shows you its guess before anything is saved.",
          "Rows you already have are recognised and skipped, so it is safe to import an export that overlaps last month's.",
        ],
      },
      {
        heading: "Approve what was filed",
        paragraphs: [
          "A merchant you have filed before is filed the same way again and shown in pencil until you approve it. Approve rows one at a time or all at once, or pick another category if the guess is wrong.",
          "A transaction with no category is left out of your budget, so the page opens by telling you how many are still to approve.",
        ],
        picture: { ...plates.transactions, caption: SAMPLE },
      },
      {
        heading: "Write a line",
        paragraphs: [
          "For cash, or anything that isn't on a statement, type it the way you would jot it down: “4.35 Pret coffee”, “+2,850 Salary”, “12/10 30 Fuel”. The add form opens filled in, with the category you used last time, for you to check and save.",
        ],
      },
      {
        heading: "Transfers between your accounts",
        paragraphs: [
          "Mark money moved between your own accounts as a transfer and it stays out of your income and spending, so you never look richer or poorer than you are.",
        ],
      },
    ],
    smallPrint: [
      {
        key: "It learns your merchants",
        text: "File “TESCO STORES 3421” once and the next import files “TESCO STORES 2211” the same way. A shop only has to be taught once.",
      },
      {
        key: "Imports you can take back",
        text: "Imported the wrong file? Undo the whole import in one action and the ledger is exactly as it was.",
      },
      {
        key: "Whose date order? Yours",
        text: "03/04 is the 3rd of April to one bank and the 4th of March to another. Balanced Money reads the order from your statement's own dates and shows it for you to check, and assumes day first only when every date could be read either way.",
      },
    ],
  },
  {
    slug: "budget",
    name: "Budget",
    headline: "Where did the money go? The budget tells you",
    standfirst:
      "Set a budget for each category, and every month comes back with a headline written from your own figures.",
    teaser:
      "Set a budget for each category and your spending fills in beside it. Each month opens with a headline: what ran over, what held, and where most of it went.",
    // Not the lead plate: the front page already leads with it.
    picture: plates.budgetShare,
    sections: [
      {
        heading: "A headline for every month",
        paragraphs: [
          "The budget opens with the month's story in one sentence, such as “Spending came in £570 under plan, led by Holidays”, and how much that leaves over compared with your plan.",
          "Beneath it, short notes say where spending ran over (and how that compares with the category's own history), where you saved, and what came in exactly on budget.",
        ],
        picture: { ...plates.budgetLead, caption: SAMPLE },
      },
      {
        heading: "Every row against its plan",
        paragraphs: [
          "Each row says in plain words how far it landed from its budget, such as “£88 under” or “£180 over”, in green when it helped and red when it didn't. A bar shows each category's share of the month's spending, in the colour of its section: Fixed, Variable or Discretionary.",
        ],
        picture: { ...plates.budgetShare, caption: SAMPLE },
      },
      {
        heading: "Filled in for you",
        paragraphs: [
          "With transactions switched on, every actual comes from your categorised transactions. Start a new month by filling it from a previous one, then adjust what has changed.",
        ],
      },
    ],
    smallPrint: [
      {
        key: "Unbudgeted spending can't hide",
        text: "Spend in a category you never budgeted for and it still appears, against a £0 budget. The thing you didn't plan for is the thing you can't miss.",
      },
      {
        key: "Transfers aren't spending",
        text: "Money moved between your own accounts is counted as a transfer, so your spending stays honest.",
      },
      {
        key: "It won't invent a comparison",
        text: "Every sentence on the page is worked out from your own figures. When there is nothing to compare against, it says nothing rather than make something up.",
      },
    ],
  },
  {
    slug: "balance",
    name: "Balance",
    headline: "Wealthy, or just spending?",
    standfirst:
      "Record what you own and owe once a month, and watch your net worth move, account by account.",
    teaser:
      "Your bank balance can mislead. The balance sheet tracks what you own and owe, and shows how each account has moved since last month.",
    picture: plates.balance,
    sections: [
      {
        heading: "Net worth, explained",
        paragraphs: [
          "The balance sheet opens with how your net worth has moved since the last month you recorded, then names the biggest gain, the biggest drop and any debt you paid down.",
        ],
        picture: { ...plates.balance, caption: SAMPLE },
      },
      {
        heading: "Every account, month on month",
        paragraphs: [
          "Each account shows how far it has moved since last month. A falling debt shows in green, because paying it down is progress.",
          "Accounts are grouped by how soon you could reach the money: current, medium-term, long-term and property.",
        ],
      },
      {
        heading: "Quick to keep up",
        paragraphs: [
          "Copy last month's values forward and type in only what changed. Copied values arrive dimmed until you confirm each one, so last month's figure never quietly poses as this month's.",
        ],
      },
    ],
    smallPrint: [
      {
        key: "Still to record, not zero",
        text: "An account you haven't filled in yet is listed as still to record. It is never counted as a drop to zero.",
      },
      {
        key: "Up isn't always good",
        text: "Net worth climbing is green; a debt climbing is red. Nothing is praised merely for going up.",
      },
    ],
  },
  {
    slug: "dashboard",
    name: "Dashboard",
    headline: "Money in, money out, month by month",
    standfirst:
      "The overall picture: how your net worth has moved, how much of your income you kept, and which spending is growing.",
    teaser:
      "The dashboard charts every month you have recorded: what came in, what went out and the share of income you kept. A bad month shows as a bad month, and the year around it shows whether it was a blip.",
    picture: plates.cashflow,
    sections: [
      {
        heading: "The year in one chart",
        paragraphs: [
          "Each month's income and spending side by side, the gap between them, and the share of your income you kept.",
        ],
        picture: {
          ...plates.cashflow,
          caption: "A sample year from the demo account.",
        },
      },
      {
        heading: "The overall picture in a sentence",
        paragraphs: [
          "The dashboard leads with how your net worth has moved since your first recorded month, then notes how many months ended in surplus, which spending section is growing, and your best month.",
        ],
      },
      {
        heading: "Nothing to fill in",
        paragraphs: [
          "The dashboard takes no input of its own. It is drawn from your transactions, budget and balances, so it fills in as they do.",
        ],
      },
    ],
    smallPrint: [
      {
        key: "Which way is good",
        text: "Every figure knows which direction is progress, so spending rising shows red and savings rising shows green.",
      },
    ],
  },
  {
    slug: "plan",
    name: "Plan",
    headline: "Will the money last?",
    standfirst:
      "Turn the accounts and budget you already keep into a lifetime forecast, with real UK tax bands.",
    teaser:
      "Add your date of birth and your accounts and budget become a forecast. Retire a year later or expect less growth, and it tells you plainly whether the money still lasts.",
    picture: plates.plan,
    sections: [
      {
        heading: "A verdict, as a range",
        paragraphs: [
          "The plan answers the question you came with: will the money last? It projects three ways, with returns better than, worse than and as expected, so the answer is a range rather than a single guess.",
        ],
        picture: {
          ...plates.plan,
          caption: "A sample plan from the demo account.",
        },
      },
      {
        heading: "Change an assumption, see it move",
        paragraphs: [
          "Retire a year later, expect a point less growth, or add an event such as selling a property at seventy-five, and the projection and its verdict move with you.",
        ],
      },
      {
        heading: "Kept in step with your figures",
        paragraphs: [
          "Press Sync to bring in your latest balances, what your budget pays into each account, and each account's terms, such as its growth rate or interest. The assumptions you have set yourself are kept.",
        ],
      },
    ],
    smallPrint: [
      {
        key: "A range, not a single number",
        text: "The verdict reads “Your money runs short at age 82 (between 78 and 91 depending on returns)” rather than pretending anyone knows the year.",
      },
      {
        key: "Real UK tax bands",
        text: "Income tax is worked out with the real bands for England, Wales and Northern Ireland, or for Scotland, not a single blended rate.",
      },
    ],
  },
  {
    slug: "settings",
    name: "Settings",
    headline: "Set it up your way",
    standfirst:
      "Your currency, how numbers look, light or dark, your own categories and accounts, and how much detail you want to keep.",
    teaser:
      "Choose your currency and number format, light or dark, and whether to track every transaction or type actuals yourself. Export or delete everything, any time.",
    picture: plates.settings,
    sections: [
      {
        heading: "Your format, your colours",
        paragraphs: [
          "Pick your currency and how numbers are written, with or without pence. Choose light or dark, or let it follow your device.",
        ],
        picture: {
          ...plates.settings,
          caption: "Settings in the demo account.",
        },
      },
      {
        heading: "As much detail as you want",
        paragraphs: [
          "Tracking every transaction gives the fullest picture, but it is your choice. Switch transactions off and type each budget actual yourself instead, or switch transfers on to mark money moved between your own accounts.",
          "Categories and accounts are yours to add, rename and retire, and the dashboard's charts can be shown or hidden.",
        ],
      },
      {
        heading: "A nudge, if you want one",
        paragraphs: [
          "An optional monthly email reminds you that your statement should be ready, and nothing more: no balances, no totals, no categories.",
        ],
      },
      {
        heading: "Your data, yours",
        paragraphs: [
          "Export everything you have entered to a file, clear your data, or delete your account outright, all from Settings.",
        ],
      },
    ],
    smallPrint: [
      {
        key: "An email with no numbers in it",
        text: "The reminder is off until you turn it on, and your figures stay behind your sign-in rather than sitting in an inbox.",
      },
      {
        key: "Deleting means deleting",
        text: "Deleting your account removes your data rather than just hiding it.",
      },
    ],
  },
];

/** The article with this slug, or undefined. */
export function featureBySlug(slug: string): Article | undefined {
  return FEATURES.find((article) => article.slug === slug);
}
