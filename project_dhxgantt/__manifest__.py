{
    "name": "Project Gantt (DHTMLX)",
    "version": "14.0.1.0.0",
    "category": "Project Management",
    "website": "https://github.com/ypapouin/odoo_dhtmlxgantt",
    "license": "GPL-3",
    "category": "Web",
    "depends": [
        "web_dhxgantt",
        "project",
    ],
    "data": [
        "security/ir.model.access.csv",
        "views/project_project.xml",
        "views/project_task_type.xml",
        "views/project_task.xml",
        "views/assets.xml",
    ],
    "qweb": [
        "static/src/xml/gantt.xml",
    ],
    "uninstall_hook": "uninstall_hook",
}
