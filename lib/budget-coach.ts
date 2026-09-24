import { totalsByCategory } from "@/lib/expenses";
import { formatMoney, formatMonth, roundMoney } from "@/lib/format";
import type { Expense } from "@/types/expense";

export interface CoachCategory {
  name: string;
  amount: number;
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

export function buildCoachSnapshot(expenses: Expense[], budget: number, now = new Date()): CoachSnapshot {
  const income = roundMoney(
    expenses.filter((expense) => expense.type === "income").reduce((sum, expense) => sum + expense.amount, 0),
  );
  const spending = expenses.filter((expense) => expense.type === "expense");
  const expenseTotal = roundMoney(spending.reduce((sum, expense) => sum + expense.amount, 0));
  const categories = totalsByCategory(spending).map((row) => ({ name: row.category, amount: row.total }));
  const dining = roundMoney(
    categories.filter((row) => DINING.has(row.name)).reduce((sum, row) => sum + row.amount, 0),
  );
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projected = day > 0 ? roundMoney((expenseTotal / day) * daysInMonth) : 0;
  const top = categories[0];
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
    categories: categories.slice(0, 6),
  };
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
