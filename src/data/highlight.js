// ─── Syntax highlighting for DAX / M / SQL code blocks ───
export function highlightCode(code) {
  const DAX_KEYWORDS = ['VAR','RETURN','EVALUATE','ORDER BY','DEFINE','MEASURE','COLUMN','TABLE','ASC','DESC','TRUE','FALSE','BLANK','IN','NOT','AND','OR','IF','ELSE','SWITCH','THEN'];
  const DAX_FUNCTIONS = [
    'CALCULATE','CALCULATETABLE','FILTER','ALL','ALLEXCEPT','ALLSELECTED','ALLNOBLANKROW',
    'VALUES','DISTINCT','RELATED','RELATEDTABLE','USERELATIONSHIP','CROSSFILTER','TREATAS',
    'SUM','SUMX','AVERAGE','AVERAGEX','MIN','MINX','MAX','MAXX','COUNT','COUNTA','COUNTX','COUNTROWS','COUNTBLANK','DISTINCTCOUNT','DISTINCTCOUNTNOBLANK',
    'DIVIDE','ROUND','ROUNDUP','ROUNDDOWN','INT','ABS','FIXED','CURRENCY',
    'RANKX','TOPN','EARLIER','EARLIEST',
    'ADDCOLUMNS','SELECTCOLUMNS','SUMMARIZE','SUMMARIZECOLUMNS','GROUPBY','CROSSJOIN','UNION','INTERSECT','EXCEPT','NATURALINNERJOIN','NATURALLEFTOUTERJOIN','DATATABLE','ROW','GENERATESERIES','GENERATE','GENERATEALL',
    'SELECTEDVALUE','HASONEVALUE','HASONEFILTER','ISFILTERED','ISCROSSFILTERED','ISBLANK','ISINSCOPE',
    'FIRSTDATE','LASTDATE','DATEADD','DATESYTD','DATESQTD','DATESMTD','TOTALYTD','TOTALQTD','TOTALMTD','SAMEPERIODLASTYEAR','PARALLELPERIOD','PREVIOUSMONTH','PREVIOUSQUARTER','PREVIOUSYEAR','NEXTMONTH','NEXTQUARTER','NEXTYEAR','STARTOFMONTH','STARTOFQUARTER','STARTOFYEAR','ENDOFMONTH','ENDOFQUARTER','ENDOFYEAR','CALENDARAUTO','CALENDAR',
    'FORMAT','CONCATENATE','CONCATENATEX','LEFT','RIGHT','MID','LEN','FIND','SEARCH','SUBSTITUTE','REPLACE','TRIM','UPPER','LOWER','PROPER','UNICHAR','REPT','COMBINEVALUES','PATHCONTAINS','PATHITEM','PATHITEMREVERSE','PATHLENGTH',
    'YEAR','MONTH','DAY','QUARTER','WEEKNUM','WEEKDAY','HOUR','MINUTE','SECOND','NOW','TODAY','DATE','TIME','EOMONTH','EDATE',
    'KEEPFILTERS','REMOVEFILTERS','LOOKUPVALUE','CONTAINS','CONTAINSROW','CONTAINSSTRING','CONTAINSSTRINGEXACT','USERPRINCIPALNAME','USERNAME','CUSTOMDATA',
    'SELECTEDMEASURE','SELECTEDMEASURENAME','ISSELECTEDMEASURE',
    'MAXA','MINA','AVERAGEA','PRODUCT','PRODUCTX','GEOMEAN','GEOMEANX','MEDIAN','MEDIANX','PERCENTILE.INC','PERCENTILE.EXC',
    'NORM.DIST','NORM.INV','NORM.S.DIST','NORM.S.INV','POISSON.DIST','BETA.DIST','BETA.INV','CHISQ.DIST','CHISQ.INV',
    // M / Power Query
    'Table.AddColumn','Table.TransformColumnTypes','Table.SelectRows','Table.RemoveColumns','Table.RenameColumns','Table.ExpandTableColumn','Table.Group','Table.Sort','Table.Distinct','Table.Buffer','Table.NestedJoin','Table.Join','Table.Combine','Table.UnpivotColumns','Table.Pivot','Table.FillDown','Table.FillUp','Table.ReplaceValue','Table.TransformColumns','Table.PromoteHeaders','Table.Skip','Table.FirstN','Table.Range','Table.SplitColumn',
    'PostgreSQL.Database','Sql.Database','Excel.Workbook','Csv.Document','Json.Document','Web.Contents','SharePoint.Files','Folder.Files',
    'List.Sum','List.Average','List.Min','List.Max','List.Count','List.Distinct','List.Sort','List.Contains','List.Transform','List.Select','List.Generate','List.Dates','List.Numbers',
    'Text.Combine','Text.Replace','Text.Split','Text.Contains','Text.Start','Text.End','Text.Length','Text.Trim','Text.Upper','Text.Lower','Text.Proper',
    'Number.Round','Number.RoundUp','Number.RoundDown','Number.From','Number.ToText',
    'Date.From','DateTime.From','Duration.From',
    'Record.Field','Record.AddField','Record.TransformFields',
    'Expression.Evaluate','Value.Type','Value.Is'
  ];
  const M_KEYWORDS = ['let','in','each','if','then','else','true','false','null','type','is','as','try','otherwise','not','and','or','meta','error','section','shared'];

  // Escape HTML
  function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // Tokenize
  const tokens = [];
  let i = 0;
  while (i < code.length) {
    // Comments
    if (code[i] === '/' && code[i+1] === '/') {
      let end = code.indexOf('\n', i);
      if (end === -1) end = code.length;
      tokens.push({ type: 'com', text: code.slice(i, end) });
      i = end;
      continue;
    }
    // Strings
    if (code[i] === '"') {
      let j = i + 1;
      while (j < code.length && code[j] !== '"') j++;
      tokens.push({ type: 'str', text: code.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    // Table[Column] references
    if (code[i] === '[') {
      let j = code.indexOf(']', i);
      if (j !== -1) {
        tokens.push({ type: 'ref', text: code.slice(i, j + 1) });
        i = j + 1;
        continue;
      }
    }
    // Numbers (standalone)
    if (/\d/.test(code[i]) && (i === 0 || /[\s,(\-+*/=<>]/.test(code[i-1]))) {
      let j = i;
      while (j < code.length && /[\d.]/.test(code[j])) j++;
      tokens.push({ type: 'num', text: code.slice(i, j) });
      i = j;
      continue;
    }
    // Words (identifiers, keywords, functions)
    if (/[a-zA-Z_]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_.]/.test(code[j])) j++;
      tokens.push({ type: 'word', text: code.slice(i, j) });
      i = j;
      continue;
    }
    // Everything else
    tokens.push({ type: 'other', text: code[i] });
    i++;
  }

  // Build highlighted HTML
  const kwSet = new Set(DAX_KEYWORDS.map(k => k.toUpperCase()));
  const fnSet = new Set(DAX_FUNCTIONS);
  const mKwSet = new Set(M_KEYWORDS);

  return tokens.map(t => {
    const e = esc(t.text);
    if (t.type === 'com') return '<span class="hl-com">' + e + '</span>';
    if (t.type === 'str') return '<span class="hl-str">' + e + '</span>';
    if (t.type === 'ref') return '<span class="hl-ref">' + e + '</span>';
    if (t.type === 'num') return '<span class="hl-num">' + e + '</span>';
    if (t.type === 'word') {
      if (kwSet.has(t.text.toUpperCase())) return '<span class="hl-kw">' + e + '</span>';
      if (mKwSet.has(t.text)) return '<span class="hl-kw">' + e + '</span>';
      if (fnSet.has(t.text)) return '<span class="hl-fn">' + e + '</span>';
      return e;
    }
    return e;
  }).join('');
}
