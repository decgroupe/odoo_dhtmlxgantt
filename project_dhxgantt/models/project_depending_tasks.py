from odoo import models, fields


class DependingTasks(models.Model):
    _name = "project.depending.tasks"
    _description = "The many2many table that has extra info (relation_type)"

    task_id = fields.Many2one('project.task', required=True)
    project_id = fields.Many2one(related='task_id.project_id')
    depending_task_id = fields.Many2one('project.task', required=True)
    relation_type = fields.Selection(
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
            'task_relation_unique', 'unique(task_id, depending_task_id)',
            'Two tasks can only have one relationship!'
        ),
    ]
