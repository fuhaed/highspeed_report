# Copyright (c) 2023, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe import _

def execute(filters=None):
    """Execute Main Report"""
    if not filters:
        filters = {}
    
    # تجهيز الأعمدة
    warehouses = get_warehouses(filters)
    columns = get_columns(warehouses, filters)
    
    # جلب البيانات
    data = get_item_warehouse_data(warehouses, filters)
    
    # تعطيل إضافة صف المجموع التلقائي من ERPNext (متوافق مع الإصدار 15)
    return columns, data, None, None, None, True

def get_columns(warehouses, filters):
    """Get Report Columns"""
    columns = [
        {
            "label": _("Item Code"),
            "fieldname": "item_code",
            "fieldtype": "Link",
            "options": "Item",
            "width": 100  # عرض أصغر لأننا سنعرض الكود فقط
        },
        {
            "label": _("Item Name"),
            "fieldname": "item_name",
            "fieldtype": "Data",
            "width": 250  # زيادة العرض لعرض الاسم كامل
        },
        {
            "label": _("UOM"),
            "fieldname": "stock_uom",
            "fieldtype": "Link",
            "options": "UOM",
            "width": 80
        },
        {
            "label": _("Item Group"),
            "fieldname": "item_group",
            "fieldtype": "Link",
            "options": "Item Group",
            "width": 120
        }
    ]
    
    # إضافة أعمدة للمستودعات
    for warehouse in warehouses:
        warehouse_field = sanitize_column_name(warehouse["name"])
        columns.append({
            "label": warehouse["name"],
            "fieldname": warehouse_field,
            "fieldtype": "Float",
            "width": 100
        })
    
    # إضافة عمود المجموع
    columns.append({
        "label": _("Total"),
        "fieldname": "total_qty",
        "fieldtype": "Float",
        "width": 100
    })
    
    # إضافة أعمدة خصائص المتغيرات إذا تم تفعيلها
    if filters.get("show_variant_attributes"):
        columns.append({
            "label": _("Variant Attributes"),
            "fieldname": "variant_attributes",
            "fieldtype": "Data",
            "width": 200
        })
    
    return columns

def sanitize_column_name(name):
    """إنشاء اسم عمود صالح من اسم المستودع"""
    return name.replace(" ", "_").replace("-", "_").lower()

def get_warehouses(filters):
    """الحصول على قائمة المستودعات بناءً على فلتر الشركة"""
    warehouse_filters = {"disabled": 0}
    
    # إضافة شرط الشركة إذا تم تحديده
    if filters.get("company"):
        warehouse_filters["company"] = filters.get("company")
    
    # إضافة شرط المستودع المحدد إذا تم تحديده
    if filters.get("warehouse"):
        warehouse_filters["name"] = filters.get("warehouse")
    
    # استعلام المستودعات
    warehouses = frappe.get_all(
        "Warehouse",
        fields=["name"],
        filters=warehouse_filters,
        order_by="name"
    )
    
    return warehouses

def get_item_warehouse_data(warehouses, filters):
    """جلب بيانات الأصناف والمستودعات"""
    # استعلام بيانات الأصناف
    items = get_items(filters)
    
    # استعلام كميات المستودعات
    warehouse_qty = get_warehouse_qty(warehouses, filters)
    
    # تجميع البيانات من كل المصادر
    data = []
    for item in items:
        item_code = item.item_code
        item_row = {
            "item_code": item_code,
            "item_name": item.item_name,
            "stock_uom": item.stock_uom,
            "item_group": item.item_group,
            "total_qty": 0
        }
        
        # إضافة خصائص المتغيرات إذا تم تفعيلها
        if filters.get("show_variant_attributes") and item.variant_of:
            item_row["variant_attributes"] = get_variant_attributes(item_code)
        
        # إضافة كميات المستودعات
        has_qty = False
        for warehouse in warehouses:
            warehouse_field = sanitize_column_name(warehouse["name"])
            qty = warehouse_qty.get((item_code, warehouse["name"]), 0)
            item_row[warehouse_field] = qty
            item_row["total_qty"] += float(qty) if qty else 0
            if qty:
                has_qty = True
        
        # تجاهل الأصناف بكميات صفرية إذا لم يتم تحديد خيار إظهارها
        if not filters.get("include_zero_qty") and not has_qty:
            continue
        
        data.append(item_row)
    
    # ترتيب البيانات حسب كود الصنف
    data = sorted(data, key=lambda k: k['item_code'])
    
    # إضافة صف المجموع فقط إذا كان هناك بيانات
    if data:
        # إعداد صف المجموع
        total_row = {
            "item_code": "",
            "item_name": "",
            "stock_uom": "",
            "item_group": _("Total"),
            "total_qty": 0,
            "is_total_row": 1
        }
        
        # حساب المجاميع لكل مستودع
        total_qty = 0
        for warehouse in warehouses:
            warehouse_field = sanitize_column_name(warehouse["name"])
            warehouse_total = sum(float(row.get(warehouse_field, 0)) for row in data)
            total_row[warehouse_field] = warehouse_total
            total_qty += warehouse_total
        
        # تعيين المجموع الكلي بعد حساب مجموع كل مستودع
        total_row["total_qty"] = total_qty
        
        data.append(total_row)
    
    return data

def get_items(filters):
    """جلب بيانات الأصناف"""
    item_filters = {"disabled": 0}
    
    # إضافة فلتر كود الصنف إذا تم تحديده
    if filters.get("item_code"):
        item_filters["name"] = filters.get("item_code")
    
    # إضافة فلتر مجموعة الصنف إذا تم تحديده
    if filters.get("item_group"):
        item_filters["item_group"] = filters.get("item_group")
    
    # استعلام بيانات الأصناف
    items = frappe.get_all(
        "Item",
        fields=["name as item_code", "item_name", "stock_uom", "item_group", "variant_of"],
        filters=item_filters,
        order_by="name"
    )
    
    return items

def get_warehouse_qty(warehouses, filters):
    """جلب كميات الأصناف في المستودعات"""
    warehouse_qty = {}
    warehouse_names = [w["name"] for w in warehouses]
    
    if not warehouse_names:
        return warehouse_qty
    
    # إعداد فلتر للاستعلام
    bin_filters = {}
    if filters.get("item_code"):
        bin_filters["item_code"] = filters.get("item_code")
    
    if warehouse_names:
        bin_filters["warehouse"] = ["in", warehouse_names]
    
    # استعلام كميات المستودعات
    bin_data = frappe.get_all(
        "Bin",
        fields=["item_code", "warehouse", "actual_qty"],
        filters=bin_filters
    )
    
    # تجميع الكميات في قاموس
    for d in bin_data:
        warehouse_qty[(d.item_code, d.warehouse)] = float(d.actual_qty) if d.actual_qty else 0
    
    return warehouse_qty

def get_variant_attributes(item_code):
    """الحصول على خصائص المتغير"""
    attributes = []
    
    item_variant_data = frappe.db.get_all('Item Variant Attribute',
        fields=['attribute', 'attribute_value'],
        filters={'parent': item_code},
        order_by='idx'
    )
    
    for attr in item_variant_data:
        attributes.append(f"{attr.attribute}: {attr.attribute_value}")
    
    return ", ".join(attributes)