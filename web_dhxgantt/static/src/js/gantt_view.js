odoo.define('web_dhxgantt.GanttView', function (require) {
    "use strict";

    var core = require('web.core');
    var AbstractView = require('web.AbstractView');
    var GanttController = require('web_dhxgantt.GanttController');
    var GanttModel = require('web_dhxgantt.GanttModel');
    var GanttRenderer = require('web_dhxgantt.GanttRenderer');
    var viewRegistry = require('web.view_registry');

    var _lt = core._lt;

    var GanttView = AbstractView.extend({
        viewType: 'dhxgantt',
        groupable: true,
        display_name: _lt('Gantt'),
        icon: 'fa-tasks',
        config: _.extend({}, AbstractView.prototype.config, {
            Controller: GanttController,
            Model: GanttModel,
            Renderer: GanttRenderer,
        }),
        init: function (viewInfo, params) {
            this._super.apply(this, arguments);

            this.loadParams.type = 'list';
            this.loadParams.fields = this.fields;
            this.loadParams.modelName = params.modelName;
            this.loadParams.linkModelName = this.arch.attrs.link_model_name;
            this.loadParams.defaultGroupBy = this.arch.attrs.default_group_by;
            
            // Save fields to read and map them with internal names
            this.loadParams.identifier = this.arch.attrs.identifier;
            this.loadParams.parent = this.arch.attrs.parent;
            this.loadParams.parent_date_start = this.arch.attrs.parent_date_start;
            this.loadParams.parent_date_stop = this.arch.attrs.parent_date_stop;
            this.loadParams.owner = this.arch.attrs.owner;
            this.loadParams.date_start = this.arch.attrs.date_start;
            this.loadParams.date_stop = this.arch.attrs.date_stop;
            this.loadParams.duration = this.arch.attrs.duration;
            this.loadParams.open = this.arch.attrs.open;
            this.loadParams.progress = this.arch.attrs.progress;
            this.loadParams.text = this.arch.attrs.text;
            this.loadParams.links = this.arch.attrs.links;
            this.loadParams.task_class = this.arch.attrs.task_class;

            this.rendererParams.modelName = params.modelName;
            this.rendererParams.fieldsViewInfo = viewInfo.fields;
            this.rendererParams.drag_progress = (this.arch.attrs.drag_progress == "true");
        },
        _processFieldsView: function (fieldsView, viewType) {
            var fv = this._super.apply(this, arguments);
            return fv;
        },
    })

    viewRegistry.add('dhxgantt', GanttView);
    return GanttView;
});