/*
 * Copyright 1999-2011 Alibaba Group.
 *  
 */
package com.alibaba.dubbo.rpc.cluster.support;

import java.util.List;

/**
 * @author <a href="mailto:gang.lvg@alibaba-inc.com">kimi</a>
 */
public interface Menu {

    public Menu getMenu();

    public void includeMenu(String menu, List<String> items);

}
