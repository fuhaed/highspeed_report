# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, getdate, cint, get_datetime
import datetime

def execute(filters=None):
    """Main execution function for the report"""
    if not filters:
        filters = {}
    
    # Set default date range if not provided
    if not filters.get("from_date"):
        filters["from_date"] = datetime.date.today().replace(day=1)
    
    if not filters.get("to_date"):
        filters["to_date"] = datetime.date.today()
    
    # Get report data
    columns = get_columns()
    data = get_cash_account_data(filters)
    
    return columns, data

def get_columns():
    """Define the columns for the report"""
    return [
        {
            "fieldname": "posting_date",
            "label": _("التاريخ"),
            "fieldtype": "Date",
            "width": 100
        },
        {
            "fieldname": "voucher_type",
            "label": _("نوع المستند"),
            "fieldtype": "Data",
            "width": 120
        },
        {
            "fieldname": "voucher_no",
            "label": _("رقم المستند"),
            "fieldtype": "Dynamic Link",
            "options": "voucher_type",
            "width": 130
        },
        {
            "fieldname": "mode_of_payment",
            "label": _("Payment Mode"),
            "fieldtype": "Data",
            "width": 110
        },
        {
            "fieldname": "description",
            "label": _("Particulars"),
            "fieldtype": "Data",
            "width": 220
        },
        {
            "fieldname": "debit_amount",
            "label": _("مدين"),
            "fieldtype": "Currency",
            "width": 110
        },
        {
            "fieldname": "credit_amount",
            "label": _("دائن"),
            "fieldtype": "Currency",
            "width": 110
        },
        {
            "fieldname": "running_balance",
            "label": _("Balance"),
            "fieldtype": "Currency",
            "width": 110
        },
        {
            "fieldname": "created_by",
            "label": _("المستخدم"),
            "fieldtype": "Link",
            "options": "User",
            "width": 120
        },
        {
            "fieldname": "cost_center",
            "label": _("Cost Center"),
            "fieldtype": "Data",
            "width": 130,
            "hidden": 1
        }
    ]

def get_mode_of_payment_account(mode_of_payment, company):
    """Get account associated with the mode of payment for the company"""
    account = frappe.db.get_value(
        "Mode of Payment Account",
        {"parent": mode_of_payment, "company": company},
        "default_account"
    )
    
    return account

def get_all_payment_accounts(company):
    """Get all payment accounts for all modes of payment in the company"""
    accounts = frappe.db.sql("""
        SELECT DISTINCT
            mopa.default_account,
            mopa.parent as mode_of_payment
        FROM
            `tabMode of Payment Account` mopa
        WHERE
            mopa.company = %s
            AND mopa.default_account IS NOT NULL
    """, (company,), as_dict=1)
    
    return accounts

def get_opening_balance(filters, accounts=None):
    """Calculate opening balance for the account(s) up to from_date"""
    opening_balance = 0
    
    if filters.get("mode_of_payment") and filters.get("mode_of_payment") != "الكل":
        # Single account for specific mode of payment
        payment_account = filters.get("payment_account")
        if not payment_account:
            return 0
        
        # Get all GL entries up to the from_date
        gl_entries = frappe.db.sql("""
            SELECT
                SUM(debit) as total_debit,
                SUM(credit) as total_credit
            FROM
                `tabGL Entry`
            WHERE
                account = %s
                AND company = %s
                AND posting_date < %s
                AND is_cancelled = 0
                AND docstatus = 1
        """, (payment_account, filters.get("company"), filters.get("from_date")), as_dict=1)
    else:
        # Multiple accounts for all modes of payment
        if not accounts:
            return 0
        account_list = [acc['default_account'] for acc in accounts]
        if not account_list:
            return 0
        
        # Get all GL entries up to the from_date
        placeholders = ', '.join(['%s'] * len(account_list))
        params = tuple(account_list) + (filters.get("company"), filters.get("from_date"))
        
        gl_entries = frappe.db.sql("""
            SELECT
                SUM(debit) as total_debit,
                SUM(credit) as total_credit
            FROM
                `tabGL Entry`
            WHERE
                account IN ({})
                AND company = %s
                AND posting_date < %s
                AND is_cancelled = 0
                AND docstatus = 1
        """.format(placeholders), params, as_dict=1)
    
    if gl_entries and gl_entries[0]:
        opening_balance = flt(gl_entries[0].total_debit) - flt(gl_entries[0].total_credit)
    
    return opening_balance

def get_transaction_description(entry):
    """Generate meaningful description based on transaction type"""
    description = entry.remarks or ""
    
    # Try to get more meaningful descriptions based on transaction type
    if entry.voucher_type == "Sales Invoice":
        # For sales invoices
        sinv = frappe.db.get_value("Sales Invoice", entry.voucher_no, ["status", "remarks", "customer_name"], as_dict=1)
        if sinv:
            desc_parts = []
            if sinv.customer_name:
                desc_parts.append(_("العميل: ") + sinv.customer_name)
            if sinv.remarks:
                desc_parts.append(sinv.remarks)
            if desc_parts:
                description = " - ".join(desc_parts)
    
    elif entry.voucher_type == "Purchase Invoice":
        # For purchase invoices
        pinv = frappe.db.get_value("Purchase Invoice", entry.voucher_no, ["status", "remarks", "supplier_name"], as_dict=1)
        if pinv:
            desc_parts = []
            if pinv.supplier_name:
                desc_parts.append(_("المورد: ") + pinv.supplier_name)
            if pinv.remarks:
                desc_parts.append(pinv.remarks)
            if desc_parts:
                description = " - ".join(desc_parts)
    
    elif entry.voucher_type == "Payment Entry":
        # For payment entries
        pe = frappe.db.get_value("Payment Entry", entry.voucher_no, 
            ["payment_type", "remarks", "party_type", "party_name"], as_dict=1)
        if pe:
            desc_parts = []
            if pe.party_type and pe.party_name:
                desc_parts.append(f"{_(pe.party_type)}: {pe.party_name}")
            if pe.remarks:
                desc_parts.append(pe.remarks)
            if desc_parts:
                description = " - ".join(desc_parts)
    
    elif entry.voucher_type == "Journal Entry":
        # For journal entries
        je = frappe.db.get_value("Journal Entry", entry.voucher_no, ["voucher_type", "user_remark"], as_dict=1)
        if je:
            je_type = ""
            if je.voucher_type:
                je_type = _(je.voucher_type)
                
            desc_parts = []
            if je_type:
                desc_parts.append(je_type)
            if je.user_remark:
                desc_parts.append(je.user_remark)
            if desc_parts:
                description = " - ".join(desc_parts)
    
    return description

def get_voucher_type_display(voucher_type, voucher_no):
    """Get the display name for voucher type, with special handling for Payment Entries"""
    if voucher_type == "Payment Entry":
        payment_type = frappe.db.get_value("Payment Entry", voucher_no, "payment_type")
        if payment_type == "Receive":
            return _("سند قبض")
        elif payment_type == "Pay":
            return _("Payment Entry")
        elif payment_type == "Internal Transfer":
            return _("سند تحويل داخلي")
        else:
            return _("سند دفع")
    elif voucher_type == "Sales Invoice":
        return _("Sales Invoice")
    elif voucher_type == "Purchase Invoice":
        return _("Purchase Invoice")
    elif voucher_type == "Journal Entry":
        return _("قيد محاسبي")
    else:
        return _(voucher_type)

def get_mode_of_payment_for_transaction(entry, account_map):
    """Get mode of payment for a specific transaction"""
    mode_of_payment = ""
    
    # First check if account is in the map
    if entry.account in account_map:
        # Default to the account's mode of payment
        default_mode = account_map[entry.account]
        
        if entry.voucher_type == "Payment Entry":
            mode_of_payment = frappe.db.get_value("Payment Entry", entry.voucher_no, "mode_of_payment") or default_mode
        
        elif entry.voucher_type == "Sales Invoice":
            # For Sales Invoice, we need to find which payment method corresponds to this GL entry
            # Check Sales Invoice Payment table for the specific account
            payment = frappe.db.sql("""
                SELECT sip.mode_of_payment 
                FROM `tabSales Invoice Payment` sip
                JOIN `tabMode of Payment Account` mopa ON mopa.parent = sip.mode_of_payment
                JOIN `tabSales Invoice` si ON si.name = sip.parent
                WHERE sip.parent = %s 
                AND mopa.default_account = %s
                AND mopa.company = si.company
                LIMIT 1
            """, (entry.voucher_no, entry.account))
            
            if payment and payment[0][0]:
                mode_of_payment = payment[0][0]
            else:
                # If not found in payments, use the default based on account
                mode_of_payment = default_mode
        
        elif entry.voucher_type == "Purchase Invoice":
            pi_mode = frappe.db.get_value("Purchase Invoice", entry.voucher_no, "mode_of_payment")
            mode_of_payment = pi_mode or default_mode
        
        elif entry.voucher_type == "Journal Entry":
            # For Journal Entry, use the default mode based on account
            mode_of_payment = default_mode
        else:
            # For other types, use account mapping
            mode_of_payment = default_mode
    
    return mode_of_payment

def get_cash_account_data(filters):
    """Get all transactions related to the specified mode of payment"""
    transactions = []
    
    # Check if we need to show all modes of payment
    show_all = not filters.get("mode_of_payment") or filters.get("mode_of_payment") == "الكل"
    
    if show_all:
        # Get all payment accounts
        payment_accounts = get_all_payment_accounts(filters.get("company"))
        if not payment_accounts:
            frappe.throw(_("لم يتم العثور على أي طرق دفع مرتبطة بحسابات لهذه الشركة."))
        
        # Create account to mode of payment mapping
        account_map = {acc['default_account']: acc['mode_of_payment'] for acc in payment_accounts}
        account_list = [acc['default_account'] for acc in payment_accounts]
        
    else:
        # Get specific mode of payment account
        payment_account = get_mode_of_payment_account(filters.get("mode_of_payment"), filters.get("company"))
        if not payment_account:
            frappe.throw(_("لم يتم العثور على حساب مرتبط بطريقة الدفع لهذه الشركة."))
        
        filters["payment_account"] = payment_account
        account_map = {payment_account: filters.get("mode_of_payment")}
        account_list = [payment_account]
    
    # Get the opening balance
    opening_balance = get_opening_balance(filters, payment_accounts if show_all else None)
    
    # Build query conditions and parameters
    conditions = []
    params = []
    
    # Account condition
    if show_all:
        placeholders = ', '.join(['%s'] * len(account_list))
        conditions.append("gl.account IN ({})".format(placeholders))
        params.extend(account_list)
    else:
        conditions.append("gl.account = %s")
        params.append(payment_account)
    
    # Common conditions
    conditions.append("gl.company = %s")
    params.append(filters.get("company"))
    
    conditions.append("gl.posting_date BETWEEN %s AND %s")
    params.extend([filters.get("from_date"), filters.get("to_date")])
    
    conditions.append("gl.is_cancelled = 0")
    conditions.append("gl.docstatus = 1")
    
    # Cost center filter
    if filters.get("cost_center"):
        conditions.append("gl.cost_center = %s")
        params.append(filters.get("cost_center"))
        
    # User filter
    if filters.get("user"):
        conditions.append("gl.owner = %s")
        params.append(filters.get("user"))
    
    # Build and execute query with additional filtering for specific mode of payment
    if not show_all and filters.get("mode_of_payment"):
        # For specific mode of payment, add more precise filtering
        query = """
            SELECT DISTINCT
                gl.posting_date,
                gl.voucher_type,
                gl.voucher_no,
                gl.account,
                gl.against,
                gl.debit,
                gl.credit,
                gl.remarks,
                gl.cost_center,
                gl.owner as created_by
            FROM
                `tabGL Entry` gl
            WHERE
                {}
                AND (
                    -- Payment Entry with specific mode
                    (gl.voucher_type = 'Payment Entry' 
                     AND EXISTS (
                        SELECT 1 FROM `tabPayment Entry` pe 
                        WHERE pe.name = gl.voucher_no 
                        AND pe.mode_of_payment = %s
                     ))
                    OR
                    -- Sales Invoice with payment in specific mode
                    (gl.voucher_type = 'Sales Invoice' 
                     AND EXISTS (
                        SELECT 1 FROM `tabSales Invoice Payment` sip 
                        WHERE sip.parent = gl.voucher_no 
                        AND sip.mode_of_payment = %s
                     ))
                    OR
                    -- Purchase Invoice with specific mode
                    (gl.voucher_type = 'Purchase Invoice'
                     AND EXISTS (
                        SELECT 1 FROM `tabPurchase Invoice` pi
                        WHERE pi.name = gl.voucher_no
                        AND (pi.mode_of_payment = %s OR pi.mode_of_payment IS NULL)
                     ))
                    OR
                    -- Journal Entry affecting the payment account
                    (gl.voucher_type = 'Journal Entry' AND gl.account = %s)
                    OR
                    -- Other voucher types
                    (gl.voucher_type NOT IN ('Payment Entry', 'Sales Invoice', 'Purchase Invoice', 'Journal Entry'))
                )
            ORDER BY
                gl.posting_date, gl.creation
        """.format(" AND ".join(conditions))
        
        # Add mode of payment parameters
        params.extend([
            filters.get("mode_of_payment"),
            filters.get("mode_of_payment"), 
            filters.get("mode_of_payment"),
            payment_account
        ])
    else:
        # Original query for showing all
        query = """
            SELECT
                gl.posting_date,
                gl.voucher_type,
                gl.voucher_no,
                gl.account,
                gl.against,
                gl.debit,
                gl.credit,
                gl.remarks,
                gl.cost_center,
                gl.owner as created_by
            FROM
                `tabGL Entry` gl
            WHERE
                {}
            ORDER BY
                gl.posting_date, gl.creation
        """.format(" AND ".join(conditions))
    
    gl_entries = frappe.db.sql(query, tuple(params), as_dict=1)
    
    # Add opening balance row if we have it
    running_balance = opening_balance
    if opening_balance != 0:
        debit_amount = opening_balance if opening_balance > 0 else 0
        credit_amount = abs(opening_balance) if opening_balance < 0 else 0
        
        # Add opening balance amounts to totals
        total_debit = debit_amount
        total_credit = credit_amount
        
        transactions.append({
            "posting_date": filters.get("from_date"),
            "voucher_type": "",
            "voucher_no": "",
            "mode_of_payment": "",
            "description": _("رصيد افتتاحي"),
            "debit_amount": debit_amount,
            "credit_amount": credit_amount,
            "running_balance": opening_balance,
            "created_by": ""
        })
    else:
        total_debit = 0
        total_credit = 0
    
    # Process GL entries
    for entry in gl_entries:
        # Get mode of payment for this transaction
        mode_of_payment = get_mode_of_payment_for_transaction(entry, account_map)
        
        # Skip if filtering by specific mode and doesn't match
        if not show_all and filters.get("mode_of_payment"):
            # For specific mode filtering, check if this entry's account matches the mode's account
            if entry.account != payment_account:
                continue
            
            # Additional validation for multi-payment invoices
            if entry.voucher_type == "Sales Invoice":
                # Check if this specific GL entry is for the filtered mode of payment
                payment_check = frappe.db.sql("""
                    SELECT 1
                    FROM `tabSales Invoice Payment` sip
                    JOIN `tabMode of Payment Account` mopa ON mopa.parent = sip.mode_of_payment
                    JOIN `tabSales Invoice` si ON si.name = sip.parent
                    WHERE sip.parent = %s 
                    AND sip.mode_of_payment = %s
                    AND mopa.default_account = %s
                    AND mopa.company = si.company
                """, (entry.voucher_no, filters.get("mode_of_payment"), entry.account))
                
                if not payment_check:
                    continue
        
        # Get description based on transaction type
        description = get_transaction_description(entry)
        
        # Calculate debit and credit amounts
        debit_amount = flt(entry.debit)
        credit_amount = flt(entry.credit)
        
        # Update running balance
        running_balance += (debit_amount - credit_amount)
        
        # Update totals
        total_debit += debit_amount
        total_credit += credit_amount
        
        # Get voucher type display name
        voucher_type_display = get_voucher_type_display(entry.voucher_type, entry.voucher_no)
        
        # Add to transactions list
        transactions.append({
            "posting_date": entry.posting_date,
            "voucher_type": voucher_type_display,
            "voucher_no": entry.voucher_no,
            "mode_of_payment": mode_of_payment,
            "description": description,
            "debit_amount": debit_amount,
            "credit_amount": credit_amount,
            "running_balance": running_balance,
            "created_by": entry.created_by,
            "cost_center": entry.cost_center
        })
    
    # Add total row
    transactions.append({
        "posting_date": "",
        "voucher_type": None,
        "voucher_no": None,
        "mode_of_payment": "",
        "description": _("Grand Total"),
        "debit_amount": total_debit,
        "credit_amount": total_credit,
        "running_balance": running_balance,
        "created_by": "",
        "is_total_row": True
    })
    
    return transactions