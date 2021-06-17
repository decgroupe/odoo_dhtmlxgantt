from odoo import _, api, models, fields


class ProjectTaskLink(models.Model):
    """ Extended `m2m` table to add extra information on links 
        between two tasks
    """
    _name = "project.task.link"
    _description = "Task Link"

    name = fields.Char(compute="_compute_name", store=True)
    source_id = fields.Many2one('project.task', required=True)
    project_id = fields.Many2one(related='source_id.project_id')
    target_id = fields.Many2one('project.task', required=True)
    type = fields.Selection(
        [
            ("0", "Finish to Start"),
            ("1", "Start to Start"),
            ("2", "Finish to Finish"),
            ("3", "Start to Finish"),
        ],
        default="0",
        required=True
    )
    state = fields.Selection(
        [
            ('draft', 'Draft'),
            ('confirm', 'Confirm'),
            ('done', 'Done'),
        ],
        default='draft'
    )

    _sql_constraints = [
        (
            'task_relation_unique', 'unique(source_id, target_id)',
            'Two tasks can only have one relationship!'
        ),
    ]

    @api.multi
    @api.depends('source_id.name', 'target_id.name', 'type')
    def _compute_name(self):
        for rec in self:
            if rec.type == "0":
                left = _('finish')
                right = _('start')
            elif rec.type == "1":
                left = _('start')
                right = _('start')
            elif rec.type == "2":
                left = _('finish')
                right = _('finish')
            elif rec.type == "3":
                left = _('start')
                right = _('finish')
            rec.name = '{} ({}) 🠢 {} ({})'.format(
                rec.source_id.name, left, rec.target_id.name, right
            )

    @api.model
    def create(self, vals):
        rec = super().create(vals)
        rec.source_id.update_gantt_schedule()
        return rec
