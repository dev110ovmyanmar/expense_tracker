import { CATEGORY_BURMESE, budgetLevel, budgetPercent, type CategoryLimits } from "@/lib/budget-status";
import { totalsByCategory } from "@/lib/expenses";
import { formatMoney, formatMonth, roundMoney } from "@/lib/format";
import type { Expense } from "@/types/expense";

export interface CoachCategory {
  name: string;
  amount: number;
  limit: number;
}

export interface CoachSnapshot {
  month: string;
  day: number;
  daysInMonth: number;
  income: number;
  expenses: number;
  net: number;
  budget: number;
  projected: number;
  dining: number;
  topCategory: string | null;
  topAmount: number;
  categories: CoachCategory[];
}

const DINING = new Set(["Food & Beverages", "Food"]);

export function buildCoachSnapshot(
  expenses: Expense[],
  budget: number,
  now = new Date(),
  categoryLimits: CategoryLimits = {},
): CoachSnapshot {
  const income = roundMoney(
    expenses.filter((expense) => expense.type === "income").reduce((sum, expense) => sum + expense.amount, 0),
  );
  const spending = expenses.filter((expense) => expense.type === "expense");
  const expenseTotal = roundMoney(spending.reduce((sum, expense) => sum + expense.amount, 0));
  const spentByName = new Map(totalsByCategory(spending).map((row) => [row.category, row.total]));
  const names = new Set<string>([...spentByName.keys(), ...Object.keys(categoryLimits)]);
  const categories = [...names].map((name) => ({
    name,
    amount: spentByName.get(name as Expense["category"]) ?? 0,
    limit: categoryLimits[name as Expense["category"]] ?? 0,
  }));
  const dining = roundMoney(
    categories.filter((row) => DINING.has(row.name)).reduce((sum, row) => sum + row.amount, 0),
  );
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projected = day > 0 ? roundMoney((expenseTotal / day) * daysInMonth) : 0;
  const ranked = categories.sort((a, b) => b.amount - a.amount);
  const top = ranked[0];
  return {
    month: formatMonth(now),
    day,
    daysInMonth,
    income,
    expenses: expenseTotal,
    net: roundMoney(income - expenseTotal),
    budget,
    projected,
    dining,
    topCategory: top?.name ?? null,
    topAmount: top?.amount ?? 0,
    categories: ranked.slice(0, 8),
  };
}

export function coachInsight(snapshot: CoachSnapshot): string {
  const spent = formatMoney(snapshot.expenses);
  const earned = formatMoney(snapshot.income);
  const limit = formatMoney(snapshot.budget);
  const hot = snapshot.categories
    .filter((row) => row.limit > 0 && (budgetLevel(row.amount, row.limit) === "near" || budgetLevel(row.amount, row.limit) === "over"))
    .sort((a, b) => budgetPercent(b.amount, b.limit) - budgetPercent(a.amount, a.limit))[0];
  const hotName = hot ? (CATEGORY_BURMESE[hot.name as keyof typeof CATEGORY_BURMESE] ?? hot.name) : "";

  if (snapshot.income === 0 && snapshot.expenses === 0) {
    return "ဒီလစာရင်းမရှိသေးပါ။ လစာ သို့မဟုတ် ဘောက်ချာတစ်ခု ထည့်ပေးပါ။ ပြီးရင် ဒီလအသုံးစရိတ်ကို ကြည့်ပြီး အားပေးစကား ပြောပေးပါမယ်။";
  }
  if (hot && budgetLevel(hot.amount, hot.limit) === "over") {
    return `${hotName} အတွက် သတ်မှတ်ထားတဲ့ ${formatMoney(hot.limit)} ကို ကျော်နေပါပြီ။ စိတ်မပူပါနဲ့။ ကျန်တဲ့ရက်တွေမှာ နည်းနည်းလျှော့လိုက်ရင် ပြန်ထိန်းနိုင်ပါတယ်။`;
  }
  if (snapshot.budget > 0 && snapshot.expenses >= snapshot.budget) {
    return `ဒီလအသုံးစရိတ် ${spent} က လစဉ်ဘတ်ဂျက် ${limit} ကို ရောက်နေပါပြီ။ ဝင်ငွေ ${earned} နဲ့ ညှိပြီး နောက်ထပ်အသုံးကို ဖြည်းဖြည်းချင်း လျှော့ကြည့်ပါ။`;
  }
  if (hot) {
    return `${hotName} က သတ်မှတ်ချက်ရဲ့ ${budgetPercent(hot.amount, hot.limit)}% ရောက်နေပါပြီ။ ကျန်သေးတဲ့အတွက် အဆင်ပြေပါတယ်။ ဒီအတိုင်း ဂရုတစိုက် ဆက်သွားပါ။`;
  }
  if (snapshot.income > 0 && snapshot.expenses > snapshot.income) {
    return `ဒီလဝင်ငွေ ${earned} ထက် အသုံး ${spent} က ပိုနေပါတယ်။ မဆိုးပါဘူး။ နောက်တစ်ခုမဝယ်ခင် ခဏစဉ်းစားလိုက်ရင် လုံလောက်ပါပြီ။`;
  }
  if (snapshot.budget > 0 && budgetLevel(snapshot.expenses, snapshot.budget) === "near") {
    return `လစဉ်ဘတ်ဂျက် ${limit} ရဲ့ ${budgetPercent(snapshot.expenses, snapshot.budget)}% သုံးပြီးပါပြီ။ အရှိန်ကောင်းပါတယ်။ ကျန်တဲ့ရက်လေးတွေကို ဒီအတိုင်း ထိန်းထားပါ။`;
  }
  if (snapshot.expenses > 0) {
    return `ဒီလဝင်ငွေ ${earned}၊ အသုံး ${spent} ပါ။ ဘတ်ဂျက်ထဲမှာ နေနိုင်သေးတာ ကောင်းပါတယ်။ ဒီအတိုင်း ဆက်ထိန်းထားပါ။`;
  }
  return `ဝင်ငွေ ${earned} ရောက်နေပါပြီ။ ပထမဆုံးအသုံးတစ်ခု မှတ်ထားလိုက်ရင် ဒီလကို အတူတူကြည့်ပေးပါမယ်။`;
}

export function localCoachMessage(snapshot: CoachSnapshot): string {
  const { income, expenses, net, budget, projected, dining, topAmount } = snapshot;
  const spent = formatMoney(expenses);
  const earned = formatMoney(income);
  const pace = formatMoney(projected);
  const limit = formatMoney(budget);

  if (income === 0 && expenses === 0) {
    return "ဒီလစာရင်းမရှိသေးဘူးနော်။ လစာထည့်လိုက်၊ ဒါမှမဟုတ် ဘောက်ချာတစ်ရွက်စကန်လုပ်လိုက်။ ပြီးရင် ဖြည်းဖြည်းသုံးနေတာလား၊ မြန်မြန်ကုန်နေတာလား ပြောပေးမယ်။";
  }
  if (expenses > 0 && dining >= topAmount && dining > 0 && dining / expenses >= 0.35) {
    return `ထမင်းစားတာ နည်းနည်းများနေပြီ။ ${formatMoney(dining)} ကုန်ပြီး၊ စုစုပေါင်း ${spent} ထဲမှာ အဲဒါက အကျယ်ဆုံးပဲ။ နောက်တစ်ခါ အိမ်မှာ လက်ဖက်ရည်သောက်လိုက်ရင် ရတယ်။`;
  }
  if (income === 0 && expenses > 0) {
    return `${spent} ထွက်သွားပြီ၊ လစာမသွင်းရသေးဘူး။ Monthly Salary နှိပ်ပြီး ဒီလလစာထည့်လိုက်ဦးနော်။`;
  }
  if (budget > 0 && projected > budget) {
    return `သုံးနေတာ နည်းနည်းမြန်နေတယ်။ ဒီအတိုင်းဆက်ရင် ဒီလကုန် ${pace} လောက်ရောက်မယ်၊ ဘတ်ဂျက် ${limit} ထက် ကျော်သွားမယ်။ နည်းနည်းလေး ဖြေးလိုက်။`;
  }
  if (net < 0) {
    return `ဝင်တာ ${earned}၊ ထွက်တာ ${spent}။ ဒီလစာရင်းက နည်းနည်းပြောင်းပြန်ဖြစ်နေတယ်။ မဆူပါဘူး၊ နည်းနည်းပဲ သတိထားလိုက်။`;
  }
  if (budget > 0 && expenses <= budget) {
    return `တော်တော်ကောင်းတယ်။ ${spent} ပဲ ကုန်သေးတယ်၊ ဘတ်ဂျက် ${limit} ထဲမှာ နေသေးတယ်။ ဒီအတိုင်းပဲ ဆက်သွား။`;
  }
  if (income > 0 && expenses === 0) {
    return `လစာ ${earned} ဝင်လာပြီ။ ပိုက်ဆံအိတ်အဆင်ပြေတယ်။ ပထမဆုံး ဘောက်ချာပေါ်လာရင် မှတ်ထားလိုက်ဦး။`;
  }
  return `အဆင်ပြေတဲ့ လ။ ဝင်တာ ${earned}၊ ထွက်တာ ${spent}။ ဒီအတိုင်း ဆက်သွားလို့ ရတယ်။`;
}
