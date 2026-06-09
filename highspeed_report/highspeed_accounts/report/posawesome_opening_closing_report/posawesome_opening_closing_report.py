import frappe
from frappe.utils import flt, get_datetime, fmt_money, getdate
from frappe import _


def execute(filters=None):
    columns = get_columns(filters)
    data = get_data(filters)
    
    # Get the total row from data for report summary
    total_row = None
    for row in data:
        if row.get("is_total_row"):
            total_row = row
            break
    
    # Create report summary if we have totals
    report_summary = None
    if total_row:
        report_summary = [
            {
                "value": total_row.get("opening_amount", 0),
                "label": _("Total Opening"),
                "indicator": "blue",
                "datatype": "Currency"
            },
            {
                "value": total_row.get("sales_amount", 0),
                "label": _("Total Sales"),
                "indicator": "green",
                "datatype": "Currency"
            },
            {
                "value": total_row.get("expected_amount", 0),
                "label": _("Total Expected"),
                "indicator": "orange",
                "datatype": "Currency"
            },
            {
                "value": total_row.get("closing_amount", 0),
                "label": _("Total Closing"),
                "indicator": "purple",
                "datatype": "Currency"
            },
            {
                "value": abs(total_row.get("difference", 0)),
                "label": _("Total Difference"),
                "indicator": "red" if total_row.get("difference", 0) < 0 else "green",
                "datatype": "Currency"
            }
        ]
    
    return columns, data, None, None, report_summary


def get_doctype_names():
    doctype_opening = "POS Opening Shift"
    doctype_closing = "POS Closing Shift"
    doctype_opening_detail = "POS Opening Shift Detail"
    doctype_closing_detail = "POS Closing Shift Detail"
    fk_opening_shift = "pos_opening_shift"
    
    # Fallback to highspeed_pos doctypes if posawesome is not installed
    if not frappe.db.exists("DocType", doctype_opening) and frappe.db.exists("DocType", "HSPOS Opening Shift"):
        doctype_opening = "HSPOS Opening Shift"
        doctype_closing = "HSPOS Closing Shift"
        doctype_opening_detail = "HSPOS Opening Shift Detail"
        doctype_closing_detail = "HSPOS Closing Shift Detail"
        fk_opening_shift = "hspos_opening_shift"
        
    return doctype_opening, doctype_closing, doctype_opening_detail, doctype_closing_detail, fk_opening_shift


def get_columns(filters):
    doctype_opening, doctype_closing, _, _, _ = get_doctype_names()
    
    columns = [
        {
            "label": _("Opening Shift"),
            "fieldname": "opening_shift",
            "fieldtype": "Link",
            "options": doctype_opening,
            "width": 180
        },
        {
            "label": _("Closing Shift"),
            "fieldname": "closing_shift",
            "fieldtype": "Link",
            "options": doctype_closing,
            "width": 180
        },
        {
            "label": _("Start Date"),
            "fieldname": "start_date",
            "fieldtype": "Datetime",
            "width": 150
        },
        {
            "label": _("End Date"),
            "fieldname": "end_date",
            "fieldtype": "Datetime",
            "width": 150
        },
        {
            "label": _("POS Profile"),
            "fieldname": "pos_profile",
            "fieldtype": "Link",
            "options": "POS Profile",
            "width": 150
        },
        {
            "label": _("Cashier"),
            "fieldname": "cashier",
            "fieldtype": "Link",
            "options": "User",
            "width": 120
        },
        {
            "label": _("Status"),
            "fieldname": "status",
            "fieldtype": "Data",
            "width": 100
        }
    ]
    
    if filters.get("show_payment_details"):
        columns.append({
            "label": _("Mode of Payment"),
            "fieldname": "mode_of_payment",
            "fieldtype": "Link",
            "options": "Mode of Payment",
            "width": 140
        })
    
    columns.extend([
        {
            "label": _("Opening Amount"),
            "fieldname": "opening_amount",
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "label": _("Sales Amount"),
            "fieldname": "sales_amount",
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "label": _("Expected Amount"),
            "fieldname": "expected_amount",
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "label": _("Closing Amount"),
            "fieldname": "closing_amount",
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "label": _("Difference"),
            "fieldname": "difference",
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "label": _("Difference %"),
            "fieldname": "difference_percentage",
            "fieldtype": "Percent",
            "width": 100
        }
    ])
    
    return columns


def get_data(filters):
    rows = []
    filters = filters or {}
    from_date = filters.pop("from_date", None)
    to_date = filters.pop("to_date", None)
    show_payment_details = filters.pop("show_payment_details", 0)
    pos_profile_filter = filters.pop("pos_profile", None)
    user_filter = filters.pop("user", None)
    company = filters.get("company", frappe.defaults.get_user_default("company"))

    doctype_opening, doctype_closing, doctype_opening_detail, doctype_closing_detail, fk_opening_shift = get_doctype_names()

    if from_date:
        from_date = get_datetime(from_date)
    if to_date:
        to_date = get_datetime(to_date)

    closing_filters = {
        "docstatus": ["!=", 2]
    }
    
    if pos_profile_filter:
        closing_filters["pos_profile"] = pos_profile_filter
    if user_filter:
        closing_filters["user"] = user_filter
    if company:
        closing_filters["company"] = company

    closing_shifts = frappe.get_all(
        doctype_closing,
        filters=closing_filters,
        fields=[
            "name", fk_opening_shift, "period_start_date", 
            "period_end_date", "user", "pos_profile", "docstatus",
            "posting_date", "company"
        ]
    )

    if from_date or to_date:
        closing_shifts = [
            c for c in closing_shifts
            if (not from_date or get_datetime(c.period_end_date) >= from_date)
            and (not to_date or get_datetime(c.period_end_date) <= to_date)
        ]

    currency = frappe.get_cached_value("Company", company, "default_currency") if company else "SAR"
    
    # Track processed data to avoid duplicates
    processed_shifts = set()

    for closing in closing_shifts:
        opening_name = closing.get(fk_opening_shift)
        if not opening_name:
            continue
        
        # Skip if already processed (in case of duplicates)
        shift_key = f"{opening_name}-{closing.name}"
        if shift_key in processed_shifts:
            continue
        processed_shifts.add(shift_key)
        
        opening_data = frappe.db.get_value(
            doctype_opening, 
            opening_name, 
            ["period_start_date", "user"],
            as_dict=True
        )
        
        if not opening_data:
            continue

        if show_payment_details:
            opening_details = frappe.get_all(
                doctype_opening_detail,
                filters={"parent": opening_name},
                fields=["mode_of_payment", "amount"]
            )
            opening_map = {d.mode_of_payment: flt(d.amount) for d in opening_details}

            closing_details = frappe.get_all(
                doctype_closing_detail,
                filters={"parent": closing.name},
                fields=[
                    "mode_of_payment", "expected_amount", 
                    "closing_amount", "difference"
                ]
            )
            
            sales_by_mode = get_sales_by_mode(opening_name, closing.name, doctype_opening_detail, doctype_closing_detail)
            
            closing_map = {d.mode_of_payment: d for d in closing_details}

            modes = set(opening_map.keys()) | set(closing_map.keys())
            for mop in modes:
                closing_row = closing_map.get(mop, {})
                expected_amt = flt(closing_row.get("expected_amount", 0))
                closing_amt = flt(closing_row.get("closing_amount", 0))
                diff = flt(closing_row.get("difference", 0))
                diff_percent = (diff / expected_amt * 100) if expected_amt else 0
                
                row = {
                    "opening_shift": opening_name,
                    "closing_shift": closing.name,
                    "start_date": opening_data.period_start_date,
                    "end_date": closing.period_end_date,
                    "pos_profile": closing.pos_profile,
                    "cashier": closing.user,
                    "status": _("Submitted") if closing.docstatus == 1 else _("Draft"),
                    "mode_of_payment": mop,
                    "opening_amount": flt(opening_map.get(mop, 0)),
                    "sales_amount": flt(sales_by_mode.get(mop, 0)),
                    "expected_amount": expected_amt,
                    "closing_amount": closing_amt,
                    "difference": diff,
                    "difference_percentage": diff_percent,
                    "currency": currency
                }
                rows.append(row)
        else:
            closing_totals = frappe.db.sql(f"""
                SELECT 
                    SUM(expected_amount) as expected_amount,
                    SUM(closing_amount) as closing_amount,
                    SUM(difference) as difference
                FROM `tab{doctype_closing_detail}`
                WHERE parent = %s
            """, closing.name, as_dict=True)[0]
            
            opening_total = frappe.db.sql(f"""
                SELECT SUM(amount) as amount
                FROM `tab{doctype_opening_detail}`
                WHERE parent = %s
            """, opening_name, as_dict=True)[0]
            
            total_sales = get_total_sales(opening_name, closing.name, doctype_opening_detail, doctype_closing_detail, doctype_closing)
            
            expected_amt = flt(closing_totals.expected_amount)
            closing_amt = flt(closing_totals.closing_amount)
            diff = flt(closing_totals.difference)
            diff_percent = (diff / expected_amt * 100) if expected_amt else 0

            row = {
                "opening_shift": opening_name,
                "closing_shift": closing.name,
                "start_date": opening_data.period_start_date,
                "end_date": closing.period_end_date,
                "pos_profile": closing.pos_profile,
                "cashier": closing.user,
                "status": _("Submitted") if closing.docstatus == 1 else _("Draft"),
                "opening_amount": flt(opening_total.amount),
                "sales_amount": flt(total_sales),
                "expected_amount": expected_amt,
                "closing_amount": closing_amt,
                "difference": diff,
                "difference_percentage": diff_percent,
                "currency": currency
            }
            rows.append(row)

    # Calculate totals properly
    if rows:
        # Always calculate fresh totals
        total_opening = 0
        total_sales = 0
        total_expected = 0
        total_closing = 0
        total_difference = 0
        
        for row in rows:
            if not row.get("is_total_row"):
                total_opening += flt(row.get("opening_amount", 0))
                total_sales += flt(row.get("sales_amount", 0))
                total_expected += flt(row.get("expected_amount", 0))
                total_closing += flt(row.get("closing_amount", 0))
                total_difference += flt(row.get("difference", 0))
        
        total_row = {
            "opening_shift": _("Total"),
            "closing_shift": "",
            "opening_amount": total_opening,
            "sales_amount": total_sales,
            "expected_amount": total_expected,
            "closing_amount": total_closing,
            "difference": total_difference,
            "is_total_row": True,
            "currency": currency
        }
        
        if show_payment_details:
            total_row["mode_of_payment"] = ""
        
        if total_expected > 0:
            total_row["difference_percentage"] = (total_difference / total_expected * 100)
        else:
            total_row["difference_percentage"] = 0
            
        rows.append(total_row)

    return rows


def get_sales_by_mode(opening_shift, closing_shift, doctype_opening_detail="POS Opening Shift Detail", doctype_closing_detail="POS Closing Shift Detail"):
    # Get from POS Closing Shift Payment details
    payment_details = frappe.get_all(
        doctype_closing_detail,
        filters={"parent": closing_shift},
        fields=["mode_of_payment", "expected_amount"]
    )
    
    if payment_details:
        # Get opening amounts
        opening_details = frappe.get_all(
            doctype_opening_detail,
            filters={"parent": opening_shift},
            fields=["mode_of_payment", "amount"]
        )
        opening_map = {d.mode_of_payment: flt(d.amount) for d in opening_details}
        
        sales_by_mode = {}
        for payment in payment_details:
            mode = payment.mode_of_payment
            expected = flt(payment.expected_amount)
            opening = opening_map.get(mode, 0)
            # Sales = Expected - Opening
            sales_by_mode[mode] = expected - opening
        
        return sales_by_mode
    
    return {}


def get_total_sales(opening_shift, closing_shift, doctype_opening_detail="POS Opening Shift Detail", doctype_closing_detail="POS Closing Shift Detail", doctype_closing="POS Closing Shift"):
    # Get sales from POS Closing Shift directly
    closing_data = frappe.db.get_value(
        doctype_closing,
        closing_shift,
        ["grand_total", "net_total"],
        as_dict=True
    )
    
    if closing_data and closing_data.get("grand_total"):
        return flt(closing_data.grand_total)
    
    # If no grand_total in closing shift, calculate from expected amounts
    expected_total = frappe.db.sql(f"""
        SELECT SUM(expected_amount) as total
        FROM `tab{doctype_closing_detail}`
        WHERE parent = %s
    """, closing_shift)
    
    opening_total = frappe.db.sql(f"""
        SELECT SUM(amount) as total
        FROM `tab{doctype_opening_detail}`
        WHERE parent = %s
    """, opening_shift)
    
    expected = flt(expected_total[0][0]) if expected_total and expected_total[0][0] else 0
    opening = flt(opening_total[0][0]) if opening_total and opening_total[0][0] else 0
    
    # Sales = Expected - Opening
    return expected - opening