# Copyright (c) 2026, Highspeed and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, getdate, add_days

def execute(filters=None):
    if not filters:
        filters = {}

    company = filters.get("company")
    if not company:
        return get_columns(), [], None, None, []

    columns = get_columns()
    data = get_data(filters)
    summary = get_report_summary(data)

    return columns, data, None, None, summary

def get_columns():
    return [
        {
            "label": _("Category"),
            "fieldname": "category",
            "fieldtype": "Data",
            "width": 180
        },
        {
            "label": _("Metric"),
            "fieldname": "metric",
            "fieldtype": "Data",
            "width": 260
        },
        {
            "label": _("Value"),
            "fieldname": "value",
            "fieldtype": "Currency",
            "width": 160
        },
        {
            "label": _("Remarks"),
            "fieldname": "remarks",
            "fieldtype": "Data",
            "width": 300
        }
    ]

def get_data(filters):
    company = filters.get("company")
    from_date = filters.get("from_date")
    to_date = filters.get("to_date")
    
    data = []
    
    # 1. Cash & Bank Balances
    cash_bank_accounts = frappe.db.sql("""
        SELECT name, account_name, account_type 
        FROM `tabAccount` 
        WHERE company = %s AND account_type IN ('Cash', 'Bank') AND is_group = 0
    """, (company,), as_dict=True)
    
    total_cash = 0.0
    total_bank = 0.0
    account_balances = []
    
    if cash_bank_accounts:
        acc_names = [a.name for a in cash_bank_accounts]
        # Cumulative balance up to to_date
        balances = frappe.db.sql(f"""
            SELECT account, SUM(debit - credit) as balance 
            FROM `tabGL Entry` 
            WHERE account IN ({", ".join(["%s"] * len(acc_names))}) 
              AND posting_date <= %s 
              AND is_cancelled = 0 
            GROUP BY account
        """, tuple(acc_names) + (to_date,), as_dict=True)
        
        balance_map = {b.account: flt(b.balance) for b in balances}
        
        for acc in cash_bank_accounts:
            bal = balance_map.get(acc.name, 0.0)
            if acc.account_type == 'Cash':
                total_cash += bal
            else:
                total_bank += bal
            account_balances.append({
                "account_name": acc.account_name,
                "balance": bal,
                "type": acc.account_type
            })

    # Net Inflow / Outflow during filtered period
    inflow_outflow = {"inflow": 0.0, "outflow": 0.0}
    if cash_bank_accounts:
        acc_names = [a.name for a in cash_bank_accounts]
        io = frappe.db.sql(f"""
            SELECT SUM(debit) as inflow, SUM(credit) as outflow 
            FROM `tabGL Entry` 
            WHERE account IN ({", ".join(["%s"] * len(acc_names))}) 
              AND posting_date BETWEEN %s AND %s 
              AND is_cancelled = 0
        """, tuple(acc_names) + (from_date, to_date), as_dict=True)[0]
        inflow_outflow["inflow"] = flt(io.inflow)
        inflow_outflow["outflow"] = flt(io.outflow)

    # 2. Receivables & Payables (AR & AP)
    today = getdate()
    
    # Receivables (AR)
    receivables = frappe.db.sql("""
        SELECT posting_date, due_date, outstanding_amount 
        FROM `tabSales Invoice` 
        WHERE company = %s AND docstatus = 1 AND outstanding_amount > 0 AND posting_date <= %s
    """, (company, to_date), as_dict=True)
    
    ar_total = 0.0
    ar_overdue = 0.0
    ar_aging_30 = 0.0
    ar_aging_60 = 0.0
    ar_aging_90 = 0.0
    
    for r in receivables:
        amt = flt(r.outstanding_amount)
        ar_total += amt
        if r.due_date and getdate(r.due_date) < today:
            ar_overdue += amt
            
        age_days = (today - getdate(r.posting_date)).days
        if age_days <= 30:
            ar_aging_30 += amt
        elif age_days <= 60:
            ar_aging_60 += amt
        else:
            ar_aging_90 += amt

    # Payables (AP)
    payables = frappe.db.sql("""
        SELECT posting_date, due_date, outstanding_amount 
        FROM `tabPurchase Invoice` 
        WHERE company = %s AND docstatus = 1 AND outstanding_amount > 0 AND posting_date <= %s
    """, (company, to_date), as_dict=True)
    
    ap_total = 0.0
    ap_overdue = 0.0
    ap_aging_30 = 0.0
    ap_aging_60 = 0.0
    ap_aging_90 = 0.0
    
    for p in payables:
        amt = flt(p.outstanding_amount)
        ap_total += amt
        if p.due_date and getdate(p.due_date) < today:
            ap_overdue += amt
            
        age_days = (today - getdate(p.posting_date)).days
        if age_days <= 30:
            ap_aging_30 += amt
        elif age_days <= 60:
            ap_aging_60 += amt
        else:
            ap_aging_90 += amt

    # 3. Tax / VAT
    tax_accounts = frappe.db.sql("""
        SELECT name FROM `tabAccount` 
        WHERE company = %s AND account_type = 'Tax' AND is_group = 0
    """, (company,), as_dict=True)
    
    vat_collected = 0.0
    vat_paid = 0.0
    
    if tax_accounts:
        t_accs = [t.name for t in tax_accounts]
        vat_data = frappe.db.sql(f"""
            SELECT 
                SUM(CASE WHEN credit > debit THEN credit - debit ELSE 0 END) as collected,
                SUM(CASE WHEN debit > credit THEN debit - credit ELSE 0 END) as paid
            FROM `tabGL Entry`
            WHERE account IN ({", ".join(["%s"] * len(t_accs))}) 
              AND posting_date BETWEEN %s AND %s 
              AND is_cancelled = 0
        """, tuple(t_accs) + (from_date, to_date), as_dict=True)[0]
        vat_collected = flt(vat_data.collected)
        vat_paid = flt(vat_data.paid)

    net_vat_liability = vat_collected - vat_paid

    # 4. Sales & Profitability
    # Net Sales
    sales_info = frappe.db.sql("""
        SELECT 
            SUM(CASE WHEN is_return = 0 THEN base_grand_total ELSE -base_grand_total END) as net_sales
        FROM `tabSales Invoice`
        WHERE company = %s AND docstatus = 1 AND posting_date BETWEEN %s AND %s
    """, (company, from_date, to_date), as_dict=True)[0]
    net_sales = flt(sales_info.net_sales)

    # Net Purchases
    purchases_info = frappe.db.sql("""
        SELECT 
            SUM(CASE WHEN is_return = 0 THEN base_grand_total ELSE -base_grand_total END) as net_purchases
        FROM `tabPurchase Invoice`
        WHERE company = %s AND docstatus = 1 AND posting_date BETWEEN %s AND %s
    """, (company, from_date, to_date), as_dict=True)[0]
    net_purchases = flt(purchases_info.net_purchases)

    # COGS & Expenses
    cogs_accounts = frappe.db.sql("""
        SELECT name FROM `tabAccount` 
        WHERE company = %s AND account_type = 'Cost of Goods Sold' AND is_group = 0
    """, (company,), as_dict=True)
    
    cogs = 0.0
    if cogs_accounts:
        c_accs = [c.name for c in cogs_accounts]
        cogs_val = frappe.db.sql(f"""
            SELECT SUM(debit - credit) as balance 
            FROM `tabGL Entry` 
            WHERE account IN ({", ".join(["%s"] * len(c_accs))}) 
              AND posting_date BETWEEN %s AND %s 
              AND is_cancelled = 0
        """, tuple(c_accs) + (from_date, to_date), as_dict=True)[0]
        cogs = flt(cogs_val.balance)

    # Other Expenses (root_type = Expense excluding COGS)
    other_expenses = 0.0
    expense_accounts = frappe.db.sql("""
        SELECT name FROM `tabAccount` 
        WHERE company = %s AND root_type = 'Expense' AND account_type != 'Cost of Goods Sold' AND is_group = 0
    """, (company,), as_dict=True)
    
    if expense_accounts:
        # Filter out COGS if any overlap
        e_accs = [e.name for e in expense_accounts]
        if cogs_accounts:
            c_names = set(c.name for c in cogs_accounts)
            e_accs = [x for x in e_accs if x not in c_names]
            
        if e_accs:
            exp_val = frappe.db.sql(f"""
                SELECT SUM(debit - credit) as balance 
                FROM `tabGL Entry` 
                WHERE account IN ({", ".join(["%s"] * len(e_accs))}) 
                  AND posting_date BETWEEN %s AND %s 
                  AND is_cancelled = 0
            """, tuple(e_accs) + (from_date, to_date), as_dict=True)[0]
            other_expenses = flt(exp_val.balance)

    net_profit = net_sales - cogs - other_expenses

    # Add Cash & Bank
    data.append({"category": _("Cash & Bank"), "metric": _("Cash in Hand"), "value": total_cash, "remarks": _("Total cash balance across all registers")})
    data.append({"category": _("Cash & Bank"), "metric": _("Bank Balances"), "value": total_bank, "remarks": _("Total balance in bank accounts")})
    data.append({"category": _("Cash & Bank"), "metric": _("Total Liquidity"), "value": total_cash + total_bank, "remarks": _("Cash + Bank Balances")})
    data.append({"category": _("Cash & Bank"), "metric": _("Net Inflow (Debit)"), "value": inflow_outflow["inflow"], "remarks": _("Total debit transactions this period")})
    data.append({"category": _("Cash & Bank"), "metric": _("Net Outflow (Credit)"), "value": inflow_outflow["outflow"], "remarks": _("Total credit transactions this period")})
    
    # Add accounts for detailed js consumption
    for acc in account_balances:
        data.append({
            "category": _("Cash & Bank Accounts Detail"),
            "metric": acc["account_name"],
            "value": acc["balance"],
            "remarks": acc["type"]
        })

    # Add Receivables (AR)
    data.append({"category": _("Accounts Receivable (AR)"), "metric": _("Total Receivables"), "value": ar_total, "remarks": _("Total outstanding customer invoice balances")})
    data.append({"category": _("Accounts Receivable (AR)"), "metric": _("Overdue Receivables"), "value": ar_overdue, "remarks": _("Receivables past their invoice due dates")})
    data.append({"category": _("Accounts Receivable (AR)"), "metric": _("Receivables (0-30 Days)"), "value": ar_aging_30, "remarks": _("Outstanding within 30 days")})
    data.append({"category": _("Accounts Receivable (AR)"), "metric": _("Receivables (30-60 Days)"), "value": ar_aging_60, "remarks": _("Outstanding within 30 to 60 days")})
    data.append({"category": _("Accounts Receivable (AR)"), "metric": _("Receivables (60+ Days)"), "value": ar_aging_90, "remarks": _("Outstanding overdue for more than 60 days")})

    # Add Payables (AP)
    data.append({"category": _("Accounts Payable (AP)"), "metric": _("Total Payables"), "value": ap_total, "remarks": _("Total outstanding supplier invoice balances")})
    data.append({"category": _("Accounts Payable (AP)"), "metric": _("Overdue Payables"), "value": ap_overdue, "remarks": _("Payables past their invoice due dates")})
    data.append({"category": _("Accounts Payable (AP)"), "metric": _("Payables (0-30 Days)"), "value": ap_aging_30, "remarks": _("Supplier outstanding within 30 days")})
    data.append({"category": _("Accounts Payable (AP)"), "metric": _("Payables (30-60 Days)"), "value": ap_aging_60, "remarks": _("Supplier outstanding within 30 to 60 days")})
    data.append({"category": _("Accounts Payable (AP)"), "metric": _("Payables (60+ Days)"), "value": ap_aging_90, "remarks": _("Supplier outstanding overdue for more than 60 days")})

    # Add Tax / VAT
    data.append({"category": _("Tax & VAT"), "metric": _("VAT Collected (Sales)"), "value": vat_collected, "remarks": _("VAT Output collected on Sales")})
    data.append({"category": _("Tax & VAT"), "metric": _("VAT Paid (Purchases)"), "value": vat_paid, "remarks": _("VAT Input paid on Purchases")})
    data.append({"category": _("Tax & VAT"), "metric": _("Net VAT Liability"), "value": net_vat_liability, "remarks": _("VAT Output - VAT Input")})

    # Add Sales & Profit
    data.append({"category": _("Sales & Profit"), "metric": _("Net Sales"), "value": net_sales, "remarks": _("Sales grand total minus returns")})
    data.append({"category": _("Sales & Profit"), "metric": _("Net Purchases"), "value": net_purchases, "remarks": _("Purchase grand total minus returns")})
    data.append({"category": _("Sales & Profit"), "metric": _("Cost of Goods Sold (COGS)"), "value": cogs, "remarks": _("Cost of sales posted this period")})
    data.append({"category": _("Sales & Profit"), "metric": _("Operating Expenses"), "value": other_expenses, "remarks": _("Expenses posted to expense ledger accounts (excluding COGS)")})
    data.append({"category": _("Sales & Profit"), "metric": _("Net Operating Profit"), "value": net_profit, "remarks": _("Sales - COGS - Expenses")})

    return data

def get_report_summary(data):
    # Fetch KPI card metric rows
    liquidity = next((row["value"] for row in data if row["metric"] == _("Total Liquidity") and row["category"] == _("Cash & Bank")), 0.0)
    receivables = next((row["value"] for row in data if row["metric"] == _("Total Receivables")), 0.0)
    payables = next((row["value"] for row in data if row["metric"] == _("Total Payables")), 0.0)
    profit = next((row["value"] for row in data if row["metric"] == _("Net Operating Profit")), 0.0)

    return [
        {
            "value": liquidity,
            "label": _("Total Liquidity"),
            "indicator": "green",
            "datatype": "Currency"
        },
        {
            "value": receivables,
            "label": _("Total Receivables"),
            "indicator": "blue",
            "datatype": "Currency"
        },
        {
            "value": payables,
            "label": _("Total Payables"),
            "indicator": "red",
            "datatype": "Currency"
        },
        {
            "value": profit,
            "label": _("Net Profit"),
            "indicator": "orange",
            "datatype": "Currency"
        }
    ]
