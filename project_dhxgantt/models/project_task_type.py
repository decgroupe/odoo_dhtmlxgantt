from odoo import fields, models, api


class ProjectTaskType(models.Model):
    _inherit = 'project.task.type'

    gantt_class = fields.Char(
        help="CSS class used to render tasks in gantt view",
    )

    @api.onchange('name')
    def onchange_name(self):
        for rec in self:
            if not rec.gantt_class:
                rec.gantt_class = rec.name.replace(' ', '_').lower()
