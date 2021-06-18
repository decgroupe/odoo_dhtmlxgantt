import datetime
import json
import logging

from datetime import timedelta

from odoo import models, fields, api
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class ProjectTask(models.Model):
    _inherit = "project.task"

    planned_duration = fields.Integer(
        'Duration',
        default=420,
    )
    lag_time = fields.Integer('Lag Time')
    downstream_task_ids = fields.One2many(
        comodel_name='project.task.link',
        inverse_name='source_id',
        help='Tasks that depend on this task.',
    )
    upstream_task_ids = fields.One2many(
        comodel_name='project.task.link',
        inverse_name='target_id',
        help="Tasks on which this task depends.",
    )
    recursive_upstream_task_ids = fields.Many2many(
        string='Recursive Dependencies',
        comodel_name='project.task',
        compute='_compute_recursive_upstream_task_ids'
    )
    links = fields.Char(
        string='Links',
        compute="_compute_links",
        help="Links serialized as JSON"
    )
    gantt_class = fields.Char(
        compute="_compute_gantt_class",
        help="CSS class used to render this task in gantt view",
    )

    @api.multi
    def write(self, vals):
        res = super().write(vals)
        return res

    def _get_calendar_id(self):
        if self.user_id and self.user_id.employee_ids and self.user_id.employee_ids[
            0].resource_calendar_id:
            return self.user_id.employee_ids[0].resource_calendar_id
        elif self.project_id and self.project_id.resource_calendar_id:
            return self.project_id.resource_calendar_id
        elif self.env.user.company_id and self.env.user.company_id.resource_calendar_id:
            return self.env.user.company_id.resource_calendar_id
        return False

    @api.multi
    def plan(self, calendar_id, planned_duration, date_start):
        self.ensure_one()
        if not date_start:
            raise Exception('Missing starting date')
        date_end = calendar_id.plan_minutes(planned_duration, date_start)
        if not date_end:
            raise Exception(
                'Invalid ending date when planning from {} with '
                'a duration of {}'.format(date_start, planned_duration)
            )
        return date_end

    @api.multi
    def update_gantt_schedule(self):
        res = []
        if not 'gantt_scheduling' in self.env.context:
            for rec in self:
                res += rec.with_context(gantt_scheduling=True
                                       )._update_gantt_schedule()
        return res

    @api.multi
    def _update_gantt_schedule(self):
        self.ensure_one()
        res = [self.id]
        snap = self.env.context.get('gantt_duration_unit') == 'day'
        calendar_id = self._get_calendar_id()
        # Snap to day limits when gantt view is day, week, month, etc.
        if snap and calendar_id.is_before_worktime(self.date_start):
            self.date_start = calendar_id.snap_to_day_start(self.date_start)
        # Use calendar planning to compute an ending date
        self.date_end = self.plan(
            calendar_id, self.planned_duration, self.date_start
        )
        # Snap to day limits when gantt view is day, week, month, etc.
        if snap and calendar_id.is_after_worktime(self.date_end):
            self.date_end = calendar_id.snap_to_day_end(self.date_end)
        _logger.info(
            '[{}] >> start={} end={} using CALENDAR {}'.format(
                self.name, self.date_start, self.date_end, calendar_id.name
            )
        )
        # Operate same logic on all downstream tasks
        for link_id in self.downstream_task_ids:
            task_id = link_id.target_id
            task_id.date_start = self.date_end
            res += task_id._update_gantt_schedule()
        return res

    @api.depends('stage_id.gantt_class')
    def _compute_gantt_class(self):
        for rec in self:
            rec.gantt_class = ''
            if rec.stage_id and rec.stage_id.gantt_class:
                css_name = rec.stage_id.gantt_class.replace(' ', '_').lower()
                if css_name:
                    rec.gantt_class = 'o_dhx_gantt_task_stage_{}'.format(
                        css_name
                    )

    @api.depends('upstream_task_ids')
    def _compute_recursive_upstream_task_ids(self):
        for rec in self:
            rec.recursive_upstream_task_ids = rec.get_dependency_tasks(
                task=rec,
                recursive=True,
            )

    @api.model
    def get_dependency_tasks(self, task, recursive=False):
        dependency_tasks = task.with_context(
            prefetch_fields=False,
        ).upstream_task_ids
        if recursive:
            for t in dependency_tasks:
                dependency_tasks |= self.get_dependency_tasks(t, recursive)
        return dependency_tasks

    @api.multi
    def _compute_links(self):
        for r in self:
            links = []
            for link in r.upstream_task_ids:
                json_obj = {
                    'id': link.id,
                    'databaseId': link.id,
                    'source': link.source_id.id,
                    'target': link.target_id.id,
                    'type': link.type
                }
                links.append(json_obj)
            r.links = json.dumps(links)

    def duration_between_dates(self, date_from, date_to):
        return (date_to - date_from).days

    def add_days(self, target_date, days):
        return target_date + timedelta(days=days)

    @api.multi
    def compute_critical_path(self):
        # evidently the critical path is the longest path on the network graph
        # evidently this algorithm does not work

        # project = self.project_id
        # tasks = project.task_ids.sorted('date_start')
        tasks = self

        critical_path = []
        critical_tasks = []
        critical_links = []
        # last_end_date = False
        current_task = tasks and tasks[0] or False
        while current_task:
            critical_path.append(current_task)
            critical_tasks.append(current_task.id)
            # _logger.info(current_task.downstream_task_ids)
            # depending_tasks = current_task.downstream_task_ids.mapped('target_id')
            # sorted_by_duration = depending_tasks.sorted('planned_duration', True)
            sorted_by_duration = current_task.downstream_task_ids.sorted(
                lambda dep: dep.target_id.planned_duration, reverse=True
            )
            if sorted_by_duration:
                current_task = sorted_by_duration[0].target_id
                critical_links.append(sorted_by_duration[0].id)
            else:
                current_task = False

        # _logger.info('critical_path')
        txt = ''
        for path in critical_path:
            txt += str(path.date_start) + ' >> '
        # _logger.info(txt)
        return {'tasks': critical_tasks, 'links': critical_links}

    @api.multi
    def bf_traversal_schedule(self):
        projects = self.mapped('project_id')
        if len(projects) > 1:
            raise UserError(
                "Can't auto schedule more than one project in the same time."
            )

        # not using project.task_ids because it has a default domain
        tasks = self.env['project.task'].search(
            [('project_id', '=', projects.id)]
        )
        leading_tasks = tasks.filtered(lambda t: not t.upstream_task_ids)

        # Mark all the vertices as not visited
        visited = []

        # _logger.info('LEADING TASKS are ', len(leading_tasks))
        # _logger.info(leading_tasks.mapped('name'))
        # Breadth First Traversal for every task that have no dependency
        for task in leading_tasks:
            # Create a queue for BFS
            queue = []
            queue.append(task)
            traversal_counter = 0
            # visited.append(task.id)
            while queue:
                traversal_counter += 1
                if traversal_counter > 4069:
                    # break out of a possibly infinite loop
                    # _logger.info('# break out of a possibly infinite loop')
                    break
                # Dequeue a vertex from queue and print it
                s = queue.pop(0)
                # _logger.info('JUST POPPED')
                # _logger.info(s.name)
                s.schedule(visited)
                visited.append(s.id)
                # Get all adjacent vertices of the dequeued vertex s. If an
                # adjacent has not been visited, then mark it visited and
                # enqueue it
                for child in s.downstream_task_ids:
                    if child.target_id.id not in visited:
                        queue.append(child.target_id)
                        # visited.append(child.target_id.id)

    @api.multi
    def set_date_end(self):
        self.date_end = self.date_start + datetime.timedelta(
            days=self.planned_duration
        )

    @api.multi
    def schedule(self, visited):
        # _logger.info('Rescheduling task ', self and self.name or 'NONE')
        self.ensure_one()
        if not self.upstream_task_ids:
            # _logger.info('No dependencies')
            # TODO: adjust datetime for server vs local timezone
            if self.project_id and self.project_id.date_start:
                # _logger.info('setting date to project\'s')
                self.date_start = datetime.datetime.combine(
                    self.project_id.date_start, datetime.time.min
                )
                self.set_date_end()
        for parent in self.upstream_task_ids:
            # _logger.info('found dependency on ', parent)
            date_start = parent.source_id.date_start
            if not date_start:
                continue
            date_end = date_start + datetime.timedelta(
                days=parent.source_id.planned_duration
            )
            # _logger.info('schedule task {0} based on parent {1}'.format(self.name, parent.source_id.name))
            # _logger.info('parnet starts at {0} and ends at {1}'.format(date_start, date_end))
            if parent.type == "0":  # Finish to Start
                if date_end:
                    todo_date_start = date_end + datetime.timedelta(
                        days=1 - self.lag_time
                    )
                    # _logger.info('todo_date_start = {0}'.format(todo_date_start))
                    if self.id in visited:
                        self.date_start = max(todo_date_start, self.date_start)
                        set_date_end = getattr(self, "set_date_end", None)
                        if callable(set_date_end):
                            self.set_date_end()
                        # _logger.info('setting date_start to {0}'.format(self.date_start))
                    else:
                        self.date_start = todo_date_start
                        set_date_end = getattr(self, "set_date_end", None)
                        if callable(set_date_end):
                            self.set_date_end()
                        # _logger.info('setting date_start to {0}'.format(self.date_start))
            elif parent.type == "1":  # Start to Start
                if date_start:
                    todo_date_start = date_start + datetime.timedelta(
                        self.lag_time
                    )
                    # _logger.info('todo_date_start = {0}'.format(todo_date_start))
                    if self.id in visited:
                        self.date_start = max(todo_date_start, self.date_start)
                        set_date_end = getattr(self, "set_date_end", None)
                        if callable(set_date_end):
                            self.set_date_end()
                        # _logger.info('setting date_start to {0}'.format(self.date_start))
                    else:
                        self.date_start = todo_date_start
                        set_date_end = getattr(self, "set_date_end", None)
                        if callable(set_date_end):
                            self.set_date_end()
                        # _logger.info('setting date_start to {0}'.format(self.date_start))
            elif parent.type == "2":  # Finish to Finish
                if date_end:
                    todo_date_start = date_end - datetime.timedelta(
                        self.planned_duration - self.lag_time
                    )
                    # _logger.info('todo_date_start = {0}'.format(todo_date_start))
                    if self.id in visited:
                        self.date_start = max(todo_date_start, self.date_start)
                        set_date_end = getattr(self, "set_date_end", None)
                        if callable(set_date_end):
                            self.set_date_end()
                        # _logger.info('setting date_start to {0}'.format(self.date_start))
                    else:
                        self.date_start = todo_date_start
                        set_date_end = getattr(self, "set_date_end", None)
                        if callable(set_date_end):
                            self.set_date_end()
                        # _logger.info('setting date_start to {0}'.format(self.date_start))
            elif parent.type == "3":  # Start to Finish
                if date_end:
                    todo_date_start = date_start - datetime.timedelta(
                        self.planned_duration - self.lag_time
                    )
                    # _logger.info('todo_date_start = {0}'.format(todo_date_start))
                    if self.id in visited:
                        self.date_start = max(todo_date_start, self.date_start)
                        set_date_end = getattr(self, "set_date_end", None)
                        if callable(set_date_end):
                            self.set_date_end()
                        # _logger.info('setting date_start to {0}'.format(self.date_start))
                    else:
                        self.date_start = todo_date_start
                        set_date_end = getattr(self, "set_date_end", None)
                        if callable(set_date_end):
                            self.set_date_end()
                        # _logger.info('setting date_start to {0}'.format(self.date_start))
