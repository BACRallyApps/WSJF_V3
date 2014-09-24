// var jobSizeField = "c_JobSize1";
// var execMandateField = "c_ExecutiveMandate";

Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    //items:{ html:'<a href="https://help.rallydev.com/apps/2.0rc2/doc/">App SDK 2.0rc2 Docs</a>'},
    launch: function() {

        if (this.getSetting("useAlternateJobSizeField")===true)
            this.jobSizeField = this.getSetting("AlternateJobSizeField");
        else
            this.jobSizeField = "JobSize";


        this.releaseCombobox = this.add({
            xtype: "rallyreleasecombobox",
            allowNoEntry: true,
            listeners: {
                ready: this._onReleaseComboboxLoad,
                change: this._onReleaseComboboxChanged,
                scope: this
            }
        });
    },

    getSettingsFields: function() {
        var values = [
            {
                name: 'useAlternateJobSizeField',
                xtype: 'rallycheckboxfield',
                label : "Use Custom Job Size Field"
            },
            {
                name: 'useExecutiveMandateField',
                xtype: 'rallycheckboxfield',
                label : "Use Custom Executive Mandate Field"
            },
            {
                name: 'AlternateJobSizeField',
                xtype: 'rallytextfield',
                label : "Alternative Job Size Field"
            },
            {
                name: 'ExecutiveMandateField',
                xtype: 'rallytextfield',
                label : "Executive Mandate Field"
            }
            ];

        return values;
    },

    config: {
        defaultSettings : {
            useAlternateJobSizeField : false,
            useExecutiveMandateField : false,
            AlternateJobSizeField : 'c_JobSize1',
            ExecutiveMandateField : 'c_ExecutiveMandate'
        }
    },

    _onReleaseComboboxLoad: function() {
        var query = this.releaseCombobox.getQueryFromSelected();
        this._loadFeatures(query);
    },
    _onReleaseComboboxChanged: function() {
        if(this._myGrid) {
            var store = this._myGrid.getStore();
            store.clearFilter(!0), store.filter(this.releaseCombobox.getQueryFromSelected());
        }
        else {
            var query = this.releaseCombobox.getQueryFromSelected();
            this._loadFeatures(query);            
        }
    },
    _loadFeatures: function(query) {

        var fetch = ["Name", "FormattedID", "Release", "TimeCriticality", "RROEValue", "UserBusinessValue", "ValueScore", this.jobSizeField ];

        if (this.getSetting("useExecutiveMandateField"))
            fetch.push(this.getSetting("ExecutiveMandateField"));

        Ext.create("Rally.data.WsapiDataStore", {
            model: "PortfolioItem/Feature",
            autoLoad: true,
            filters: query,
            remoteSort: false,
            listeners: {
                load: function(store, records, success) {
                    this._calculateScore(records), this._updateGrid(store);
                },
                update: function(store, rec, modified, opts) {
                    //console.log("calling store update");
                    this._calculateScore([rec]);
                },
                scope: this
            },
            fetch : fetch
            // fetch: ["Name", "FormattedID", "Release", "TimeCriticality", "RROEValue", "UserBusinessValue", "ValueScore", "JobSize", "JobSize1"]
            // fetch: ["Name", "FormattedID", "Release", "TimeCriticality", "RROEValue", "UserBusinessValue", "ValueScore", jobSizeField, execMandateField]
        });
    },
    _calculateScore: function(records) {

        var that = this; 

        Ext.Array.each(records, function(feature) {
            //console.log("feature", feature.data);
            // var jobSize = feature.data.JobSize;
            var jobSize = feature.data[that.jobSizeField];
            var execMandate = that.getSetting("useExecutiveMandateField")===true ? feature.data[that.getSetting("ExecutiveMandateField")] : 1;
            execMandate = _.isUndefined(execMandate) || _.isNull(execMandate) || execMandate === 0 ? 1 : execMandate;
            // console.log("jobsize",jobSize,"execMandate",execMandate);
            var timeValue = feature.data.TimeCriticality;
            var OERR = feature.data.RROEValue;
            var userValue = feature.data.UserBusinessValue;
            var oldScore = feature.data.ValueScore;
            //console.log( "Old Score ", oldScore);
            if (jobSize > 0) { // jobSize is the denominator so make sure it's not 0
                // var score = ((userValue + timeValue + OERR ) / jobSize);
                var score = ( ((userValue + timeValue + OERR ) * execMandate) / jobSize);
                score = Math.floor( score + 0.5 );
                // var score = Math.floor(((userValue + timeValue + OERR ) / jobSize) + 0.5);
                //console.log("newscore: ", score);
                if (oldScore !== score) { // only update if score changed
                    feature.set('ValueScore', score); // set score value in db
                    //feature.save(); SDF: used to need this, now it causes a concurrency error :/
                    //console.log("Setting a new score", score);
                }
            }
        });
    },
    _createGrid: function(myStore) {
        this._myGrid = Ext.create("Rally.ui.grid.Grid", {
            xtype: "rallygrid",
            title: "Feature Scoring Grid",
            height: "98%",
            store: myStore,
            selType: "cellmodel",
            columnCfgs: [
                {
                    text: "Portfolio ID",
                    dataIndex: "FormattedID",
                    flex: 1,
                    xtype: "templatecolumn",
                    tpl: Ext.create("Rally.ui.renderer.template.FormattedIDTemplate")
                }, 
                {
                    text: "Name",
                    dataIndex: "Name",
                    flex: 2
                }, 
                // "TimeCriticality", "RROEValue", "UserBusinessValue", "JobSize", 
                "TimeCriticality", "RROEValue", "UserBusinessValue", 
                this.jobSizeField, 
                this.getSetting("useExecutiveMandateField")===true ? this.getSetting("ExecutiveMandateField") : null,
                {
                    text: "Score",
                    dataIndex: "ValueScore",
                    editor: null
                }
            ]
        }), this.add(this._myGrid);
    },
    _updateGrid: function(myStore) {
        if (this._myGrid === undefined) {
            this._createGrid(myStore);
        }
        else {
            this._myGrid.reconfigure(myStore);
        }
    }
});
