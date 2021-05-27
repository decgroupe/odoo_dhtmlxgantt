{
    'name': "Web Gantt (DHTMLX)",
    'version': '12.0.1.0.2',
    'summary':
        "This module add a new Gantt view based on the interactive "
        "HTML5 Gantt chart from DHX (see https://dhtmlx.com)",
    "category": "Project Management",
    'author': "Yann Papouin, Ubay Abdelgadir",
    'website': "https://github.com/ypapouin/odoo_dhtmlxgantt",
    'license': "GPL-3",
    'category': 'Project Management',
    'depends': ['base'],
    'data': ['views/assets.xml', ],
    'qweb': ["static/src/xml/gantt.xml", ],
}