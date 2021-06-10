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

            this.defaultGroupBy = params.defaultGroupBy ? [params.defaultGroupBy] : [];

            return this._load(params);
        },
        reload: function (id, params) {
            return this._load(params);
        },
        _load: function (params) {
            var self = this;
            params = params ? params : {};
            self.domain = params.domain || self.domain || [];
            self.modelName = params.modelName || self.modelName;
            self.groupBy = self.defaultGroupBy;
            if (params.groupBy && params.groupBy.length > 0) {
                self.groupBy = params.groupBy;
            }
            return self._rpc({
                model: self.modelName,
                method: 'read_group',
                fields: self.fieldNames,
                domain: self.domain,
                groupBy: self.groupBy,
                orderBy: [{
                    name: self.map.identifier,
                    asc: true,
                }],
                lazy: false,
            }).then(function (groups) {
                return self._rpc({
                    model: self.modelName,
                    method: 'search_read',
                    fields: self.fieldNames.concat(self.groupBy),
                    domain: self.domain,
                }).then(function (records) {
                    self.convertData(records, groups, self.groupBy);
                });
            });
        },
        convertData: function (records, groups, groupBy) {
            var data = [];
            var formatFunc = gantt.date.str_to_date("%Y-%m-%d %h:%i:%s", true);
            // todo: convert date from utc to mgt or wtever
            var self = this;

            // Create projects from groups
            groups.forEach(function (rec) {
                let parentProject = null;
                groupBy.forEach(function (field) {
                    var project = {
                        id: _.uniqueId('project-'),
                        databaseID: rec[field][0],
                        groupBy: {},
                        text: rec[field][1],
                        type: gantt.config.types.project,
                        isProject: true,
                        open: true,
                        columnTitle: rec[field][1] + ' ' + field,
                    }
                    // Add current field to groupBy domain
                    project.groupBy[field] = rec[field][0];
                    if (parentProject) {
                        project.groupBy = Object.assign({}, project.groupBy, parentProject.groupBy);
                        project.parent = parentProject.id;
                    }
                    parentProject = project;
                    data.push(project);
                });
            });

            this.res_ids = [];
            var links = [];

            // Create tasks from records
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
                task.id = record[self.map.identifier];
                task.text = record[self.map.text];
                task.type = gantt.config.types.type_task;
                task.start_date = datetime;
                task.owner = record[self.map.owner][1];
                task.duration = record[self.map.duration];
                task.progress = record[self.map.progress] / 100.0;
                task.open = record[self.map.open];
                task.links = record[self.map.links];
                task.columnTitle = task.id;

                // Retrieve and set parent from already created project/groups
                var parent = data.find(function (element) {
                    if ("groupBy" in element) {
                        var matchNeeded = 0;
                        var matchCount = 0;
                        for (const [idx, field] of Object.entries(groupBy)) {
                            if (field in record) {
                                matchNeeded++;
                                if (record[field][0] == element.groupBy[field]) {
                                    matchCount++;
                                }
                            }
                        }
                        if (matchNeeded > 0 && matchNeeded == matchCount) {
                            return element;
                        }
                    }
                });
                if (parent) {
                    task.parent = parent.id;
                }

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