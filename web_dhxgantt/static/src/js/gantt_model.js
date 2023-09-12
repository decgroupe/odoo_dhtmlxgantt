odoo.define('web_dhxgantt.GanttModel', function (require) {
    "use strict";

    // odoo/addons/web/static/src/js/views/basic/basic_model.js
    var BasicModel = require('web.BasicModel');
    var core = require('web.core');
    var field_utils = require('web.field_utils');

    var _lt = core._lt;
    var _t = core._t;

    var GanttModel = BasicModel.extend({

        __get: function (id, options) {
            var res = this._super.apply(this, arguments);
            // Get is called by AbstractController.update() and the result
            // is stored in its `state` variable
            // Each `get` call generate a new Object from localData
            if (res) {
                var element = this.localData[id];
                // Make a reference on the existing gantt data in the 
                // new datapoint
                if (element.ganttData) {
                    res.ganttData = element.ganttData;
                }
            }
            return res;
        },

        /**
         * @override
         */
        load: function (params) {
            var self = this;

            // Load params before super to ensure proper settings for `_load`
            self.fields = params.fields;
            self.modelName = params.modelName;
            self.linkModelName = params.linkModelName;
            self.parentModelName = params.parentModelName;
            self.fieldsMapping = params.fieldsMapping;
            self.parentFieldsMapping = params.parentFieldsMapping;

            self.defaultGroupedBy = params.groupBy;
            params.groupedBy = (params.groupedBy && params.groupedBy.length) ? params.groupedBy : this.defaultGroupedBy;

            var res = self._super.apply(self, arguments);
            return res;
        },

        /**
         * @override
         * Reload all data for a given resource. At any time there is at most one
         * reload operation active.
         * Note that the `params` argument is sometimes called `options`
         *
         * @param {string} id local id for a resource
         * @param {Object} [params]
         * @param {boolean} [params.keepChanges=false] if true, doesn't discard the
         *   changes on the record before reloading it
         * @returns {Deferred<string>} resolves to the id of the resource
         */
        reload: function (id, params) {
            var self = this;
            // if the groupBy is given in the params and if it is an empty array,
            // fallback on the default groupBy
            if (params && params.groupBy && !params.groupBy.length) {
                params.groupBy = self.defaultGroupedBy;
            }
            var res = self._super.apply(self, arguments);
            return res;
        },

        _getFieldNames: function (element, options) {
            var self = this;
            var fieldNames = self._super.apply(self, arguments);
            // Extend fields-to-read only to ones matching the main model
            if (element.model == this.modelName) {
                Object.keys(self.fieldsMapping).forEach(function (key) {
                    let field = self.fieldsMapping[key];
                    // Include only fields defined in the xml view
                    if (field !== undefined) {
                        // Do not add duplicates
                        if (fieldNames.indexOf(field) === -1) {
                            fieldNames.push(field);
                        }
                    };
                });
            }
            // Extend fields-to-read only to ones matching the parent model
            if (element.model == this.parentModelName) {
                Object.keys(self.parentFieldsMapping).forEach(function (key) {
                    let field = self.parentFieldsMapping[key];
                    // Include only fields defined in the xml view
                    if (field !== undefined) {
                        // Do not add duplicates
                        if (fieldNames.indexOf(field) === -1) {
                            fieldNames.push(field);
                        }
                    };
                });
            }
            return fieldNames;
        },

        _getParentFields: function () {
            var self = this;
            var values = Object.keys(self.parentFieldsMapping).filter(function (key) {
                let field = self.parentFieldsMapping[key];
                // Do not include fields not defined in the xml view
                if (field === undefined) {
                    return false;
                };
                return true;
            }).map(function (key) {
                return self.parentFieldsMapping[key];
            });
            return values;
        },

        _getDateFields: function () {
            var self = this;
            return [
                self.fieldsMapping.dateStart,
                self.fieldsMapping.dateStop,
            ]
        },

        _load: function (dataPoint, options) {
            var self = this;
            // Keep a copy of the original result values
            var _loadBasic = self._super.apply(self, arguments);
            return _loadBasic.then(function () {
                return self._loadExtraData(dataPoint).then(function () {
                    // Return original result values (we also could return dataPoint)
                    return _loadBasic;
                });
            });
        },

        _loadExtraData: function (state) {
            var self = this;
            var groups = [];
            state.data.forEach(function (handle) {
                var dataPoint = self.get(handle);
                if (dataPoint.type === "list") {
                    groups.push(dataPoint);
                }
            });

            var closedGroups = groups.filter(function (group) {
                return !group.isOpen;
            });
            var defs = closedGroups.map(function (group) {
                console.log("toggleGroup", group.id, "isOpen:", group.isOpen);
                return self.toggleGroup(group.id);
            });

            return $.when(...defs).then(
                console.log("Ungroup completed", defs.length)
            );
        },

        parseDate(rec, date_name) {
            var formatFunc = gantt.date.str_to_date("%Y-%m-%d %H:%i:%s", true);
            var date;
            if (rec[date_name]) {
                date = formatFunc(rec[date_name]);
            } else {
                date = false;
            }
            return date;
        },


        writeTask: function (data) {
            var self = this;
            if (data.isGroup) {
                return $.when();
            }
            var values = {};
            if ('text' in data && self.fieldsMapping.text != undefined) {
                values[self.fieldsMapping.text] = data.text;
            }
            if ('progress' in data && self.fieldsMapping.progress != undefined) {
                values[self.fieldsMapping.progress] = data.progress;
            }

            if ('duration' in data) {
                if (gantt.config.duration_unit == "minute") {
                    values[self.fieldsMapping.duration] = data.duration;
                } else if (gantt.config.duration_unit == "hour") {
                    values[self.fieldsMapping.duration] = data.duration * 60;
                } else if (gantt.config.duration_unit == "day") {
                    values[self.fieldsMapping.duration] = data.duration * 60 * 7;
                }
            }

            var backward = false;
            var formatFunc = gantt.date.str_to_date(gantt.config.date_format);

            if ('start_date' in data) {
                var date_start = formatFunc(data.start_date);
                values[self.fieldsMapping.dateStart] = field_utils.parse.datetime(
                    data.start_date, {}, { timezone: false }).toJSON()
            }
            if ('end_date' in data) {
                var date_stop = formatFunc(data.end_date);
                values[self.fieldsMapping.dateStop] = field_utils.parse.datetime(
                    data.end_date, {}, { timezone: false }).toJSON()
            }

            if ('previous_start_date' in data) {
                var previous_date_start = formatFunc(data.previous_start_date);
                backward = date_start < previous_date_start;
            }
            if ('previous_end_date' in data) {
                var previous_date_stop = formatFunc(data.previous_end_date);
            }

            // Get database id from dataPoint id
            var res_id = self.get(data.id).data.id;

            return self._rpc({
                model: self.modelName,
                method: 'write',
                args: [res_id, values],
                context: self.getContext(),
            }).then(function (res) {
                if (res) {
                    return self._rpc({
                        model: self.modelName,
                        method: 'gantt_schedule_update',
                        args: [[res_id], backward],
                        context: self.getContext(),
                    });
                };
            });
        },

        reloadTaskDates: function (ids) {
            var self = this;
            return self._rpc({
                model: self.modelName,
                method: 'search_read',
                fields: self._getDateFields(),
                domain: [['id', 'in', ids]],
            }).then(function (records) {
                records.forEach(function (rec) {
                    // FIXME: Retrieve gantt item id from database ID and model
                    var task = gantt.getTask(rec.id);
                    if (task) {
                        task.start_date = self.parseDate(rec, self.fieldsMapping.dateStart);
                        task.end_date = self.parseDate(rec, self.fieldsMapping.dateStop);
                    }
                });
            });
        },

        createLink: function (data) {
            var self = this;

            // Get database id from dataPoint id
            var res_id = self.get(data.id).data.id;

            var values = {};
            values.id = res_id;
            values.source_id = data.source;
            values.target_id = data.target;
            values.type = data.type;

            return self._rpc({
                model: self.linkModelName,
                method: 'create',
                args: [values],
                context: self.getContext(),
            }).then(function (res) {
                if (res) {
                    // Add (don't replace) database ID
                    var updatedData = {
                        'databaseId': res
                    };
                    gantt.updateLink(res_id, updatedData);
                    return self._rpc({
                        model: self.modelName,
                        method: 'gantt_schedule_update',
                        args: [parseInt(values.source_id)],
                        context: self.getContext(),
                    });
                };
            });
        },

        deleteLink: function (data) {
            var self = this;
            return self._rpc({
                model: self.linkModelName,
                method: 'unlink',
                args: [data.databaseId],
                context: self.getContext(),
            });
        },

        getCriticalPath: function () {
            var self = this;
            return self._rpc({
                model: self.modelName,
                method: 'compute_critical_path',
                args: [self.res_ids],
            });
        },

        schedule: function () {
            var self = this;
            return self._rpc({
                model: self.modelName,
                method: 'bf_traversal_schedule',
                args: [self.res_ids],
            });
        },

        getContext: function () {
            return { 'gantt_duration_unit': gantt.config.duration_unit }
        },

    });
    return GanttModel;
});