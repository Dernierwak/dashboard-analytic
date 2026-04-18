import streamlit as st
from supabase import Client
import pandas as pd


class Labelling():

    def __init__(self, client: Client, user_id: str, df: pd.DataFrame):
        self.supabase = client
        self.user_id = user_id
        self.df = df
        if "labels_list" not in st.session_state:
            data = self.supabase.table("profiles").select("labelling").eq("id", self.user_id).execute().data
            raw = data[0].get("labelling") if data else []
            st.session_state.labels_list = [l for l in (raw or []) if l]

    def _manage_labels(self):
        # ── Barre de progression ─────────────────────────────────────────
        if "labels" in self.df.columns and not self.df.empty:
            total = len(self.df)
            labeled = int(self.df["labels"].apply(
                lambda x: bool(x and len(x) > 0 and x[0])
            ).sum())
            pct = labeled / total if total > 0 else 0
            st.progress(pct, text=f"**{labeled} / {total}** posts labelisés ({int(pct * 100)} %)")
            st.markdown("<br>", unsafe_allow_html=True)

        st.markdown("#### Tes labels")

        if st.session_state.labels_list:
            st.pills(
                "Labels",
                options=st.session_state.labels_list,
                selection_mode="multi",
                key="pills_display",
                label_visibility="collapsed"
            )
        else:
            st.caption("Aucun label créé.")

        col_input, col_btn = st.columns([4, 1])
        with col_input:
            new_label = st.text_input("Nouveau label", placeholder="Ex: viral, UGC, campagne...", label_visibility="collapsed", key="new_label_input")
        with col_btn:
            if st.button("+ Ajouter", key="btn_add", use_container_width=True):
                if not new_label.strip():
                    st.warning("Label vide.")
                elif new_label.strip() in st.session_state.labels_list:
                    st.warning("Existe déjà.")
                else:
                    st.session_state.labels_list.append(new_label.strip())
                    self.supabase.table("profiles").update({
                        "labelling": st.session_state.labels_list
                    }).eq("id", self.user_id).execute()
                    st.rerun(scope="fragment")

        with st.expander("Supprimer ou renommer"):
            to_delete = st.multiselect(
                "Supprimer",
                options=[l for l in st.session_state.labels_list if l],
                key="labels_to_delete"
            )
            if st.button("Supprimer", key="btn_delete"):
                for label in to_delete:
                    st.session_state.labels_list.remove(label)
                self.supabase.table("profiles").update({
                    "labelling": st.session_state.labels_list
                }).eq("id", self.user_id).execute()
                st.rerun(scope="fragment")

            st.divider()

            old_labels = st.session_state.labels_list.copy()
            label_df = pd.DataFrame(old_labels, columns=["label"])
            st.data_editor(label_df, hide_index=True, key="label_editor", use_container_width=True)
            if st.button("Sauvegarder les noms", key="btn_rename"):
                editor_state = st.session_state.get("label_editor", {})
                edited_rows = editor_state.get("edited_rows", {})
                new_labels = old_labels.copy()
                for idx_str, changes in edited_rows.items():
                    if "label" in changes:
                        new_labels[int(idx_str)] = changes["label"]
                new_labels = [l for l in new_labels if l]
                st.session_state.labels_list = new_labels
                self.supabase.table("profiles").update({
                    "labelling": new_labels
                }).eq("id", self.user_id).execute()
                for old, new in zip(old_labels, new_labels):
                    if old != new:
                        posts = self.supabase.table("instagram_organic_posts").select("id,labels").eq("user_id", self.user_id).contains("labels", [old]).execute().data
                        for post in posts:
                            updated = [new if l == old else l for l in (post["labels"] or [])]
                            self.supabase.table("instagram_organic_posts").update({"labels": updated}).eq("id", post["id"]).execute()
                clear_fn = st.session_state.get("_posts_cache_clear")
                if clear_fn:
                    clear_fn()
                st.rerun(scope="fragment")

    def _edit_labels_column(self):
        """Édition des labels directement dans le tableau — un label par post via SelectboxColumn."""
        if not st.session_state.labels_list:
            st.caption("Crée d'abord des labels dans la section ci-dessus.")
            return

        display_df = self.df[["caption", "type", "date", "labels"]].copy()
        display_df["label"] = display_df["labels"].apply(lambda x: x[0] if x and len(x) > 0 else None)
        display_df = display_df.drop(columns=["labels"])

        edited = st.data_editor(
            display_df,
            column_config={
                "label": st.column_config.SelectboxColumn(
                    "Label",
                    options=[l for l in st.session_state.labels_list if l],
                    required=False,
                ),
                "caption": st.column_config.TextColumn("Caption", disabled=True),
                "type": st.column_config.TextColumn("Type", disabled=True),
                "date": st.column_config.TextColumn("Date", disabled=True),
            },
            hide_index=True,
            use_container_width=True,
            key="editor_label_col"
        )

        if st.button("Sauvegarder les labels", key="btn_save_col"):
            with st.spinner("Mise à jour..."):
                for i, row in edited.iterrows():
                    post_id = self.df["id"].iloc[i]
                    label = row["label"]
                    new_labels = [label] if label else []
                    self.supabase.table("instagram_organic_posts").update({
                        "labels": new_labels
                    }).eq("user_id", self.user_id).eq("id", post_id).execute()
            st.success("Sauvegardé.")

    def _batch_assign(self):
        """Mode batch : sélectionner des posts dans le tableau et assigner un label d'un coup."""
        if not st.session_state.labels_list:
            return

        st.markdown("#### Assignation en lot")
        st.caption("Clique sur les lignes pour les sélectionner, choisis un label, puis applique.")

        display_df = self.df[["caption", "type", "date", "labels"]].copy()
        display_df["label_actuel"] = display_df["labels"].apply(
            lambda x: x[0] if x and len(x) > 0 else "—"
        )
        display_df = display_df[["caption", "type", "date", "label_actuel"]]

        selected = st.dataframe(
            display_df,
            use_container_width=True,
            hide_index=True,
            on_select="rerun",
            selection_mode="multi-row",
            key="df_batch_select",
            column_config={
                "caption": st.column_config.TextColumn("Caption"),
                "type": st.column_config.TextColumn("Type"),
                "date": st.column_config.TextColumn("Date"),
                "label_actuel": st.column_config.TextColumn("Label actuel"),
            },
        )

        selected_rows = []
        if selected and hasattr(selected, "selection"):
            selected_rows = selected.selection.rows or []

        options = ["— choisir —"] + [l for l in st.session_state.labels_list if l]
        col_sel, col_btn = st.columns([3, 1])
        with col_sel:
            chosen = st.selectbox(
                "Label", options=options, key="batch_label_sel", label_visibility="collapsed"
            )
        with col_btn:
            label_to_apply = chosen if chosen != "— choisir —" else ""
            btn_label = f"Appliquer ({len(selected_rows)})" if selected_rows else "Appliquer"
            if st.button(btn_label, key="btn_batch_apply", use_container_width=True):
                if not selected_rows:
                    st.warning("Sélectionne au moins un post.")
                elif not label_to_apply:
                    st.warning("Choisis un label.")
                else:
                    with st.spinner("Mise à jour..."):
                        for row_idx in selected_rows:
                            post_id = str(self.df["id"].iloc[row_idx])
                            self.supabase.table("instagram_organic_posts").update(
                                {"labels": [label_to_apply]}
                            ).eq("user_id", self.user_id).eq("id", post_id).execute()
                    clear_fn = st.session_state.get("_posts_cache_clear")
                    if clear_fn:
                        clear_fn()
                    st.success(f"✓ {len(selected_rows)} post(s) mis à jour avec « {label_to_apply} ».")
                    st.rerun(scope="fragment")


# == DEBUG ==

if __name__ == "__main__":
    url = st.secrets.supabase.url
    token = st.secrets.supabase.service_role
    user_id = "11043e9a-fc29-4c71-a67b-6816a6ea2e78"
    client = Client(supabase_url=url, supabase_key=token)

    data = client.table("instagram_organic_posts").select("*").eq("user_id", user_id).execute().data
    df = pd.DataFrame(data)
    cols = ["labels"] + [c for c in df.columns if c != "labels"]
    df = df[cols]

    labelling = Labelling(client, user_id, df)
    labelling._manage_labels()
    st.divider()
    labelling._edit_labels_column()
