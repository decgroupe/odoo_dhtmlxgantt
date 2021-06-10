odoo.define('web_dhxgantt.GanttModel', function (require) {
    "use strict";

    var AbstractModel = require('web.AbstractModel');

    var GanttModel = AbstractModel.extend({
        get: function () {
            // Get is called by AbstractController.update() and the result
            // is stored in `state` variable
            var gantt_model = {
                data: this.records,
                links: this.links,
            }
            var res = {
                records: gantt_model,
            };
            return res;
        },
        load: function (params) {
            this.modelName = params.modelName;
            this.linkModelName = params.linkModelName;

            this.fieldNames = params.fieldNames;

            // Store field names mapping
            this.map = {}
            this.map.identifier = params.identifier;
            this.map.text = params.text;
            this.map.date_start = params.date_start;
            this.map.duration = params.duration;
            this.map.progress = params.progress;
            this.map.open = params.open;
            this.map.links = params.links;
            this.map.project = params.project;
            this.map.owner = params.owner;

            return this._load(params);
        },
        reload: function (id, params) {
            return this._load(params);
        },
        _load: function (params) {
            var self = this;
            params = params ? params : {};
            this.domain = params.domain || this.domain || [];
            this.modelName = params.modelName || this.modelName;
            return this._rpc({
                model: self.modelName,
                method: 'search_read',
                fields: this.fieldNames,
                domain: self.domain,
                orderBy: [{
                    name: self.map.identifier,
                    asc: true,
                }]
            }).then(function (records) {
                self.convertData(records);
            });
        },
        convertData: function (records) {
            var data = [];
            var formatFunc = gantt.date.str_to_date("%Y-%m-%d %h:%i:%s", true);
            // todo: convert date from utc to mgt or wtever
            var self = this;
            this.res_ids = [];
            var links = [];
            records.forEach(function (record) {
                self.res_ids.push(record[self.map.identifier]);
                // value.add(-self.getSession().getTZOffset(value), 'minutes')
                // data.timezone_offset = (-self.date_object.getTimezoneOffset());
                var datetime;
                if (record[self.map.date_start]) {
                    datetime = formatFunc(record[self.map.date_start]);
                } else {
                    datetime = false;
                }

                var task = {};
                if (self.map.project) {
                    var project = data.find(function (element) {
                        return element.isProject && element.projectId == record[self.map.project][0];
                    });
                    if (!project) {
                        // TODO: Add a post-process RPC to read project
                        // progress data
                        project = {
                            id: _.uniqueId('project-'),
                            projectId: record[self.map.project][0],
                            text: record[self.map.project][1],
                            type: gantt.config.types.project,
                            isProject: true,
                            open: true,
                        }
                        data.push(project);
                    }
                    task.parent = project.id;
                }
                task.id = record[self.map.identifier];
                task.text = record[self.map.text];
                task.type = gantt.config.types.type_task;
                task.start_date = datetime;
                task.owner = record[self.map.owner][1];
                task.duration = record[self.map.duration];
                task.progress = record[self.map.progress] / 100.0;
                task.open = record[self.map.open];
                task.links = record[self.map.links];

                data.push(task);
                links.push.apply(links, JSON.parse(task.links))
            });
            this.records = data;
            this.links = links;
        },
        updateTask: function (data) {
            if (data.isProject) {
                return $.when();
            }
            var values = {};
            values[this.text] = data.text;
            values[this.duration] = data.duration;
            values[this.open] = data.open;
            values[this.progress] = data.progress;

            var formatFunc = gantt.date.str_to_date("%d-%m-%Y %h:%i");
            var date_start = formatFunc(data.start_date);
            values[this.date_start] = JSON.stringify(date_start);

            return this._rpc({
                model: this.modelName,
                method: 'write',
                args: [data.id, values],
            });
        },
        createLink: function (data) {
            var values = {};
            values.id = data.id;
            values.source_id = data.source;
            values.target_id = data.target;
            values.type = data.type;

            return this._rpc({
                model: this.linkModelName,
                method: 'create',
                args: [values],
            });
        },
        deleteLink: function (data) {
            return this._rpc({
                model: this.linkModelName,
                method: 'unlink',
                args: [data.id],
            });
        },
        getCriticalPath: function () {
            return this._rpc({
                model: this.modelName,
                method: 'compute_critical_path',
                args: [this.res_ids],
            });
        },
        schedule: function () {
            var self = this;
            return this._rpc({
                model: this.modelName,
                method: 'bf_traversal_schedule',
                args: [this.res_ids],
            });
        },
    });
    return GanttModel;
});