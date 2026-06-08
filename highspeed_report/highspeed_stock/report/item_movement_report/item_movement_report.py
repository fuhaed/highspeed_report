# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, getdate, cint
from datetime import datetime

def execute(filters=None):
    if not filters:
        filters = {}
    
    # تأكد من وجود صنف والفترة الزمنية
    if not filters.get("item_code"):
        frappe.throw(_("الرجاء تحديد كود الصنف"))
    
    if not filters.get("from_date"):
        filters["from_date"] = datetime.now().replace(day=1)
    
    if not filters.get("to_date"):
        filters["to_date"] = datetime.now()
    
    # تحضير الأعمدة وجلب البيانات
    columns = get_columns(filters)
    data = get_item_movement_data(filters)
    
    return columns, data

def get_columns(filters):
    """Get Report Columns"""
    columns = [
        {
            "label": _("التاريخ"),
            "fieldname": "date",
            "fieldtype": "Date",
            "width": 100
        },
        {
            "label": _("نوع المستند"),
            "fieldname": "voucher_type",
            "fieldtype": "Data",
            "width": 130
        },
        {
            "label": _("رقم المستند"),
            "fieldname": "voucher_no",
            "fieldtype": "Dynamic Link",
            "options": "voucher_type_original",  # استخدام نوع المستند الأصلي
            "width": 130
        },
        {
            "label": _("الجهة"),
            "fieldname": "party",
            "fieldtype": "Data",
            "width": 150
        },
        {
            "label": _("نوع الحركة"),
            "fieldname": "movement_type",
            "fieldtype": "Data",
            "width": 100
        },
        {
            "label": _("Incoming Qty"),
            "fieldname": "incoming_qty",
            "fieldtype": "Float",
            "width": 120
        },
        {
            "label": _("Outgoing Qty"),
            "fieldname": "outgoing_qty",
            "fieldtype": "Float",
            "width": 120
        },
        {
            "label": _("Balance"),
            "fieldname": "balance_qty",
            "fieldtype": "Float",
            "width": 120
        },
        {
            "label": _("UOM"),
            "fieldname": "stock_uom",
            "fieldtype": "Link",
            "options": "UOM",
            "width": 80
        },
        {
            "label": _("سعر الوحدة"),
            "fieldname": "unit_price",
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "label": _("القيمة"),
            "fieldname": "value",
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "label": _("المستودع"),
            "fieldname": "warehouse",
            "fieldtype": "Link",
            "options": "Warehouse",
            "width": 120
        },
        {
            "label": _("ملاحظات"),
            "fieldname": "description",
            "fieldtype": "Data",
            "width": 200
        },
        {
            "label": _("نوع المستند الأصلي"),
            "fieldname": "voucher_type_original",
            "fieldtype": "Data",
            "width": 0,
            "hidden": 1  # إخفاء العمود لكنه يستخدم للروابط
        }
    ]
    
    # إضافة عمود المشروع إذا كان مفعل
    projects_enabled = frappe.get_single("Selling Settings").get("sales_update_frequency") != "Each Transaction"
    if projects_enabled:
        columns.insert(4, {
            "label": _("المشروع"),
            "fieldname": "project",
            "fieldtype": "Link",
            "options": "Project",
            "width": 100
        })
    
    return columns

def get_item_movement_data(filters):
    """جلب بيانات حركة الصنف"""
    # بناء شروط التصفية
    conditions = get_conditions(filters)
    
    # استعلام قيود المخزون
    stock_ledger_entries = get_stock_ledger_entries(filters, conditions)
    
    # استعلام تفاصيل المستندات
    voucher_details = get_voucher_details(stock_ledger_entries)
    
    # تجهيز البيانات للعرض
    data = []
    opening_balance = get_opening_balance(filters)
    balance_qty = opening_balance
    
    # متغيرات لإجمالي الكميات
    total_opening_qty = 0
    
    # إضافة رصيد افتتاحي
    if opening_balance != 0:
        opening_incoming = opening_balance if opening_balance > 0 else 0
        opening_outgoing = abs(opening_balance) if opening_balance < 0 else 0
        
        # حفظ الرصيد الافتتاحي الوارد
        total_opening_qty = opening_incoming
        
        data.append({
            "date": filters.get("from_date"),
            "voucher_type": format_voucher_type("Opening Balance"),
            "voucher_type_original": "",  # لا يوجد مستند مرتبط
            "voucher_no": "",
            "party": "",
            "movement_type": _("رصيد افتتاحي"),
            "incoming_qty": opening_incoming,
            "outgoing_qty": opening_outgoing,
            "balance_qty": balance_qty,
            "stock_uom": frappe.get_value("Item", filters.get("item_code"), "stock_uom"),
            "is_opening": 1,
            "document_color": "gray"  # لون خاص للرصيد الافتتاحي
        })
    
    # معالجة قيود المخزون
    for sle in stock_ledger_entries:
        # تحديث الرصيد
        balance_qty += flt(sle.actual_qty)
        
        # تحديد الجهة ونوع المستند
        party_type, party = get_party_details(sle.voucher_type, sle.voucher_no, voucher_details)
        
        # تحديد لون المستند ونوع المستند (مرتجع أم لا)
        document_color, is_return = get_document_color_and_type(sle.voucher_type, sle.voucher_no, voucher_details)
        
        # تحديد نوع الحركة
        movement_type = get_movement_type(sle.voucher_type, sle.actual_qty, is_return)
        
        # تحضير صف البيانات
        row = {
            "date": sle.posting_date,
            "voucher_type": format_voucher_type(sle.voucher_type, is_return),
            "voucher_type_original": sle.voucher_type,  # حفظ نوع المستند الأصلي للروابط
            "voucher_no": sle.voucher_no,
            "party": party,
            "movement_type": movement_type,
            "incoming_qty": sle.actual_qty if sle.actual_qty > 0 else 0,
            "outgoing_qty": abs(sle.actual_qty) if sle.actual_qty < 0 else 0,
            "balance_qty": balance_qty,
            "stock_uom": sle.stock_uom,
            "unit_price": abs(flt(sle.valuation_rate)),
            "value": abs(flt(sle.stock_value_difference)),
            "warehouse": sle.warehouse,
            "description": get_voucher_description(sle.voucher_type, sle.voucher_no, voucher_details),
            "document_color": document_color,
            "is_return": 1 if is_return else 0
        }
        
        # إضافة معلومات المشروع إذا متوفرة
        project = voucher_details.get((sle.voucher_type, sle.voucher_no, "project"))
        if project:
            row["project"] = project
        
        data.append(row)
    
    # إضافة صف المجموع
    if data:
        # حساب إجمالي الكميات مع إضافة الرصيد الافتتاحي للكمية الواردة
        total_incoming = sum(flt(row.get("incoming_qty", 0)) for row in data if not row.get("is_opening")) + total_opening_qty
        total_outgoing = sum(flt(row.get("outgoing_qty", 0)) for row in data if not row.get("is_opening"))
        total_value = sum(flt(row.get("value", 0)) for row in data if not row.get("is_opening"))
        
        data.append({
            "voucher_type": _("Total"),
            "voucher_type_original": "",
            "incoming_qty": total_incoming,
            "outgoing_qty": total_outgoing,
            "value": total_value,
            "balance_qty": balance_qty,
            "stock_uom": frappe.get_value("Item", filters.get("item_code"), "stock_uom"),
            "is_total_row": 1
        })
    
    return data

def get_conditions(filters):
    """بناء شروط الاستعلام"""
    conditions = []
    
    # شروط أساسية
    conditions.append("item_code = %(item_code)s")
    conditions.append("posting_date BETWEEN %(from_date)s AND %(to_date)s")
    
    # فلترة حسب المستودع
    if filters.get("warehouse"):
        conditions.append("warehouse = %(warehouse)s")
    
    # فلترة حسب نوع المستند
    if filters.get("voucher_type"):
        voucher_type_map = {
            "فاتورة شراء": "Purchase Invoice",
            _("Sales Invoice"): "Sales Invoice",
            "استلام مشتريات": "Purchase Receipt",
            "إذن تسليم": "Delivery Note",
            "سند مخزون": "Stock Entry",
            "تسوية مخزون": "Stock Reconciliation"
        }
        
        # تحويل اسم المستند العربي إلى اسم المستند في النظام إذا لزم الأمر
        voucher_type = filters.get("voucher_type")
        if voucher_type in voucher_type_map:
            voucher_type = voucher_type_map[voucher_type]
        
        conditions.append("voucher_type = %(voucher_type)s")
        filters["voucher_type"] = voucher_type
    
    # فلترة حسب الشركة
    if filters.get("company"):
        conditions.append("company = %(company)s")
    
    return " AND ".join(conditions)

def get_stock_ledger_entries(filters, conditions):
    """استعلام قيود المخزون"""
    # تحقق من وجود عمود remarks في جدول Stock Ledger Entry
    columns = frappe.db.get_table_columns("Stock Ledger Entry")
    has_remarks = "remarks" in columns
    
    # بناء استعلام SQL ديناميكي بناءً على الأعمدة المتاحة
    select_fields = """
        posting_date, posting_time, voucher_type, voucher_no,
        actual_qty, qty_after_transaction, valuation_rate,
        stock_value, stock_value_difference, warehouse, stock_uom
    """
    
    # إضافة حقل remarks إذا كان موجودًا
    if has_remarks:
        select_fields += ", remarks"
    
    return frappe.db.sql("""
        SELECT
            {select_fields}
        FROM
            `tabStock Ledger Entry`
        WHERE
            {conditions}
        ORDER BY
            posting_date, posting_time, creation
    """.format(
        select_fields=select_fields,
        conditions=conditions
    ), filters, as_dict=1)

def get_voucher_details(stock_ledger_entries):
    """جلب تفاصيل المستندات لتحديد الجهة والمشروع والوصف"""
    voucher_details = {}
    voucher_nos = list(set([(sle.voucher_type, sle.voucher_no) for sle in stock_ledger_entries]))
    
    # جمع أنواع المستندات المختلفة
    purchase_invoices = []
    sales_invoices = []
    purchase_receipts = []
    delivery_notes = []
    stock_entries = []
    
    for voucher_type, voucher_no in voucher_nos:
        if voucher_type == "Purchase Invoice":
            purchase_invoices.append(voucher_no)
        elif voucher_type == "Sales Invoice":
            sales_invoices.append(voucher_no)
        elif voucher_type == "Purchase Receipt":
            purchase_receipts.append(voucher_no)
        elif voucher_type == "Delivery Note":
            delivery_notes.append(voucher_no)
        elif voucher_type == "Stock Entry":
            stock_entries.append(voucher_no)
    
    # جلب تفاصيل فواتير الشراء
    if purchase_invoices:
        for d in frappe.db.sql("""
            SELECT name, supplier, supplier_name, project, remarks, is_return
            FROM `tabPurchase Invoice`
            WHERE name IN %s
        """, [purchase_invoices], as_dict=1):
            party = d.supplier_name or d.supplier
            voucher_details[("Purchase Invoice", d.name, "party")] = party
            voucher_details[("Purchase Invoice", d.name, "project")] = d.project
            voucher_details[("Purchase Invoice", d.name, "description")] = d.remarks
            voucher_details[("Purchase Invoice", d.name, "is_return")] = d.is_return
    
    # جلب تفاصيل فواتير المبيعات
    if sales_invoices:
        for d in frappe.db.sql("""
            SELECT name, customer, customer_name, project, remarks, is_return
            FROM `tabSales Invoice`
            WHERE name IN %s
        """, [sales_invoices], as_dict=1):
            party = d.customer_name or d.customer
            voucher_details[("Sales Invoice", d.name, "party")] = party
            voucher_details[("Sales Invoice", d.name, "project")] = d.project
            voucher_details[("Sales Invoice", d.name, "description")] = d.remarks
            voucher_details[("Sales Invoice", d.name, "is_return")] = d.is_return
    
    # جلب تفاصيل استلام المشتريات
    if purchase_receipts:
        for d in frappe.db.sql("""
            SELECT name, supplier, supplier_name, project, remarks, is_return
            FROM `tabPurchase Receipt`
            WHERE name IN %s
        """, [purchase_receipts], as_dict=1):
            party = d.supplier_name or d.supplier
            voucher_details[("Purchase Receipt", d.name, "party")] = party
            voucher_details[("Purchase Receipt", d.name, "project")] = d.project
            voucher_details[("Purchase Receipt", d.name, "description")] = d.remarks
            voucher_details[("Purchase Receipt", d.name, "is_return")] = d.is_return
    
    # جلب تفاصيل أذون التسليم
    if delivery_notes:
        for d in frappe.db.sql("""
            SELECT name, customer, customer_name, project, remarks, is_return
            FROM `tabDelivery Note`
            WHERE name IN %s
        """, [delivery_notes], as_dict=1):
            party = d.customer_name or d.customer
            voucher_details[("Delivery Note", d.name, "party")] = party
            voucher_details[("Delivery Note", d.name, "project")] = d.project
            voucher_details[("Delivery Note", d.name, "description")] = d.remarks
            voucher_details[("Delivery Note", d.name, "is_return")] = d.is_return
    
    # جلب تفاصيل سندات المخزون
    if stock_entries:
        for d in frappe.db.sql("""
            SELECT name, purpose, project, remarks
            FROM `tabStock Entry`
            WHERE name IN %s
        """, [stock_entries], as_dict=1):
            party = _("تحويل مخزون") + " - " + (_(d.purpose) if d.purpose else "")
            voucher_details[("Stock Entry", d.name, "party")] = party
            voucher_details[("Stock Entry", d.name, "project")] = d.project
            voucher_details[("Stock Entry", d.name, "description")] = d.remarks
            voucher_details[("Stock Entry", d.name, "is_return")] = 0  # سندات المخزون ليست مرتجعات
    
    return voucher_details

def get_party_details(voucher_type, voucher_no, voucher_details):
    """تحديد الجهة ونوع المستند"""
    party_type = ""
    party = ""
    
    # استخدام البيانات المحفظة مسبقًا
    if (voucher_type, voucher_no, "party") in voucher_details:
        party = voucher_details[(voucher_type, voucher_no, "party")]
        
        if voucher_type in ["Purchase Invoice", "Purchase Receipt"]:
            party_type = "Supplier"
        elif voucher_type in ["Sales Invoice", "Delivery Note"]:
            party_type = "Customer"
    
    return party_type, party

def get_document_color_and_type(voucher_type, voucher_no, voucher_details):
    """تحديد لون المستند ونوعه (عادي أو مرتجع)"""
    is_return = False
    
    # التحقق مما إذا كان المستند مرتجعًا
    if (voucher_type, voucher_no, "is_return") in voucher_details:
        is_return = bool(voucher_details[(voucher_type, voucher_no, "is_return")])
    
    # تعيين اللون بناءً على نوع المستند وما إذا كان مرتجعًا
    color_map = {
        "Purchase Invoice": "blue" if not is_return else "return-blue",
        "Sales Invoice": "green" if not is_return else "return-green",
        "Purchase Receipt": "blue" if not is_return else "return-blue",
        "Delivery Note": "green" if not is_return else "return-green",
        "Stock Entry": "purple",
        "Stock Reconciliation": "orange",
        "Material Issue": "red",
        "Material Receipt": "teal",
        "Material Transfer": "purple",
        "Opening Balance": "gray"
    }
    
    return color_map.get(voucher_type, "black"), is_return

def get_voucher_description(voucher_type, voucher_no, voucher_details):
    """الحصول على وصف المستند"""
    description = ""
    
    # استخدام البيانات المحفظة مسبقًا
    if (voucher_type, voucher_no, "description") in voucher_details:
        description = voucher_details[(voucher_type, voucher_no, "description")]
    
    return description or ""

def get_opening_balance(filters):
    """حساب الرصيد الافتتاحي للصنف قبل تاريخ البدء"""
    opening_balance = 0
    
    # استعلام الرصيد قبل الفترة
    opening_balance_data = frappe.db.sql("""
        SELECT SUM(actual_qty) as opening_balance
        FROM `tabStock Ledger Entry`
        WHERE
            item_code = %(item_code)s
            AND posting_date < %(from_date)s
            {warehouse_condition}
            {company_condition}
    """.format(
        warehouse_condition=f"AND warehouse = %(warehouse)s" if filters.get("warehouse") else "",
        company_condition=f"AND company = %(company)s" if filters.get("company") else ""
    ), filters, as_dict=1)
    
    if opening_balance_data and opening_balance_data[0].opening_balance:
        opening_balance = flt(opening_balance_data[0].opening_balance)
    
    return opening_balance

def format_voucher_type(voucher_type, is_return=False):
    """تنسيق نوع المستند للعرض"""
    voucher_type_map = {
        "Purchase Invoice": _("فاتورة شراء"),
        "Sales Invoice": _("Sales Invoice"),
        "Purchase Receipt": _("استلام مشتريات"),
        "Delivery Note": _("إذن تسليم"),
        "Stock Entry": _("سند مخزون"),
        "Stock Reconciliation": _("تسوية مخزون"),
        "Material Issue": _("صرف مواد"),
        "Material Receipt": _("استلام مواد"),
        "Material Transfer": _("تحويل مواد"),
        "Opening Balance": _("Opening Balance")
    }
    
    display_name = voucher_type_map.get(voucher_type, voucher_type)
    
    # إضافة كلمة "مرتجع" للمستندات المرتجعة
    if is_return:
        display_name = _("مرتجع") + " " + display_name
    
    return display_name

def get_movement_type(voucher_type, actual_qty, is_return=False):
    """تحديد نوع الحركة (وارد، صادر، مرتجع وارد، مرتجع صادر)"""
    if actual_qty > 0:
        if is_return and voucher_type in ["Sales Invoice", "Delivery Note"]:
            return _("مرتجع صادر")
        else:
            return _("وارد")
    elif actual_qty < 0:
        if is_return and voucher_type in ["Purchase Invoice", "Purchase Receipt"]:
            return _("مرتجع وارد")
        else:
            return _("صادر")
    else:
        return _("تعديل")
